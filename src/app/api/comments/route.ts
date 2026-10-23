import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { NotificationService } from '@/lib/services/notification-service';

// POST /api/comments - Create a new comment
// Note: Ensure Prisma Client is generated: `npx prisma generate`
export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { orderId, stepName, category, structuredData, note, triggeredStatus, content, mentions, replyToId } = body;

        // Use 'content' or 'note' as message text
        const messageText = content || note || '';

        if (!orderId || !stepName) {
            return NextResponse.json({ error: 'orderId and stepName are required' }, { status: 400 });
        }

        // VALIDATION: Check if stepName is valid for this product
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            select: { id: true, woId: true, productId: true, data: true }
        });

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        const product = await prisma.product.findUnique({
            where: { id: order.productId }
        });

        if (product) {
            const config = JSON.parse(product.config);
            // Steps usually come from config.steps or config.steps
            const validSteps: string[] = config.steps || [];

            if (validSteps.length > 0 && !validSteps.includes(stepName)) {
                return NextResponse.json({
                    error: `Invalid step name. '${stepName}' is not a valid step for this product.`
                }, { status: 400 });
            }
        }

        // Fetch all approved non-kiosk users to map roles/names
        const allUsers = await prisma.user.findMany({
            where: {
                status: 'approved',
                role: { not: 'kiosk' }
            },
            select: { id: true, role: true, username: true }
        });

        // Default mention behavior when user doesn't explicitly pick a recipient:
        // - Operators ('user') notify '@Supervisor' (admins + supervisors) by default
        // - Supervisors/Admins notify '@Everyone' by default
        const effectiveMentions: string[] = Array.isArray(mentions) && mentions.length > 0
            ? mentions
            : [session.role === 'user' ? '@Supervisor' : '@Everyone'];

        let mentionGroup: string | undefined;
        let targetUserIds: string[] = [];

        effectiveMentions.forEach((mention: string) => {
            if (mention === '@Supervisor' || mention === '@Supervisors') {
                mentionGroup = '@Supervisor';
                const supervisors = allUsers.filter((u: any) => u.role === 'admin' || u.role === 'supervisor').map((u: any) => u.id);
                targetUserIds.push(...supervisors);
            } else if (mention === '@Everyone') {
                mentionGroup = '@Everyone';
                targetUserIds.push(...allUsers.map((u: any) => u.id));
            } else if (mention === '@Operator' || mention === '@Operators') {
                mentionGroup = '@Operator';
                const operators = allUsers.filter((u: any) => u.role === 'user').map((u: any) => u.id);
                targetUserIds.push(...operators);
            } else {
                // Specific User ID or Username
                const byId = allUsers.find((u: any) => u.id === mention);
                if (byId) {
                    targetUserIds.push(byId.id);
                } else {
                    const cleanName = mention.replace(/^@/, '');
                    const byName = allUsers.find((u: any) => u.username.toLowerCase() === cleanName.toLowerCase());
                    if (byName) targetUserIds.push(byName.id);
                }
            }
        });

        // If replying to a specific comment, make sure that comment's author is notified
        let validReplyToId: string | null = null;
        if (replyToId) {
            const parentComment = await prisma.comment.findUnique({
                where: { id: replyToId },
                select: { id: true, userId: true }
            });
            if (parentComment) {
                validReplyToId = parentComment.id;
                targetUserIds.push(parentComment.userId);
            }
        }

        // Deduplicate and exclude sender from receiving self-notification
        targetUserIds = Array.from(new Set(targetUserIds)).filter(id => id !== session.userId);

        // Fallback: if default '@Supervisor' yielded 0 other users (e.g., no other supervisor account), notify all other approved users
        if (targetUserIds.length === 0 && (!Array.isArray(mentions) || mentions.length === 0)) {
            targetUserIds = allUsers.map((u: any) => u.id).filter((id: string) => id !== session.userId);
        }

        const mergedStructuredData = {
            ...(structuredData || {}),
            ...(mentionGroup ? { mentionGroup } : {})
        };

        // Normalize triggeredStatus ('HOLD' -> 'Hold', 'QN' -> 'QN')
        const normalizedTriggeredStatus = triggeredStatus
            ? (triggeredStatus.toUpperCase() === 'HOLD' ? 'Hold' : triggeredStatus.toUpperCase() === 'QN' ? 'QN' : triggeredStatus)
            : null;

        // Create comment
        const comment = await prisma.comment.create({
            data: {
                orderId,
                stepName,
                content: messageText, // Required field
                category: category || 'GENERAL',
                structuredData: Object.keys(mergedStructuredData).length > 0 ? JSON.stringify(mergedStructuredData) : null,
                note: note || null,
                triggeredStatus: normalizedTriggeredStatus,
                replyToId: validReplyToId,
                userId: session.userId,
                readBy: JSON.stringify([session.userId]), // Creator has read it
                mentionedUserIds: JSON.stringify(targetUserIds)
            },
            include: {
                user: {
                    select: { username: true, employeeId: true, role: true }
                }
            }
        });

        // If triggeredStatus is Hold or QN, actually update the Order's step status and create OperationLog
        if (normalizedTriggeredStatus === 'Hold' || normalizedTriggeredStatus === 'QN') {
            try {
                const currentData = JSON.parse(order.data || '{}');
                const previousValue = currentData[stepName] || '';
                currentData[stepName] = normalizedTriggeredStatus;

                await prisma.$transaction([
                    prisma.order.update({
                        where: { id: order.id },
                        data: { data: JSON.stringify(currentData) }
                    }),
                    prisma.operationLog.create({
                        data: {
                            action: normalizedTriggeredStatus,
                            details: JSON.stringify({
                                step: stepName,
                                previousValue,
                                newValue: normalizedTriggeredStatus,
                                reason: messageText
                            }),
                            userId: session.userId,
                            orderId: order.id,
                            snapshot: JSON.stringify({
                                woId: order.woId,
                                productName: product?.name || 'Unknown'
                            })
                        }
                    })
                ]);
            } catch (statusErr) {
                console.error('Failed to update order status from comment triggeredStatus:', statusErr);
            }
        }

        // Update commentStats cache on the order
        await updateOrderCommentStats(orderId);

        // Trigger External Webhooks (on_message, plus on_hold / on_qn if status was triggered)
        try {
            const notifService = NotificationService.getInstance();
            const senderName = comment.user?.username || session.username || 'User';
            const productName = product?.name || 'Unknown';

            void notifService.send('on_message', {
                orderId: order.woId,
                step: stepName,
                status: normalizedTriggeredStatus || category || 'COMMENT',
                productName,
                operator: senderName,
                sender: senderName,
                message: `[WO: ${order.woId} | ${stepName}] ${messageText}`
            });

            if (normalizedTriggeredStatus === 'Hold') {
                void notifService.send('on_hold', {
                    orderId: order.woId,
                    step: stepName,
                    status: 'Hold',
                    productName,
                    operator: senderName,
                    message: messageText
                });
            } else if (normalizedTriggeredStatus === 'QN') {
                void notifService.send('on_qn', {
                    orderId: order.woId,
                    step: stepName,
                    status: 'QN',
                    productName,
                    operator: senderName,
                    message: messageText
                });
            }
        } catch (webhookErr) {
            console.error('[Webhook] Error sending comment notification:', webhookErr);
        }

        // Publish real-time SSE update so other users' tables and notification bells refresh immediately
        try {
            const { redis } = await import('@/lib/redis');
            await redis.publish('system-updates', JSON.stringify({
                type: 'ORDER_UPDATE',
                subType: 'COMMENT_UPDATE',
                productId: order.productId,
                woId: order.woId,
                orderId: order.id,
                step: stepName,
                action: normalizedTriggeredStatus || 'COMMENT'
            }));
        } catch (rErr) {
            console.error('Redis publish error on comment create:', rErr);
        }

        return NextResponse.json({
            success: true,
            comment: {
                ...comment,
                structuredData: comment.structuredData ? JSON.parse(comment.structuredData) : null,
                readBy: comment.readBy ? JSON.parse(comment.readBy) : []
            }
        });

    } catch (error) {
        console.error('Create comment error:', error);
        return NextResponse.json({
            error: 'Failed to create comment',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

// GET /api/comments?orderId=xxx&stepName=xxx
export async function GET(req: NextRequest) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const orderId = searchParams.get('orderId');
        const stepName = searchParams.get('stepName');

        if (!orderId || !stepName) {
            return NextResponse.json({ error: 'orderId and stepName are required' }, { status: 400 });
        }

        const comments = await prisma.comment.findMany({
            where: {
                orderId,
                stepName
            },
            include: {
                user: {
                    select: { username: true, employeeId: true, role: true }
                },
                replyTo: {
                    select: {
                        id: true,
                        content: true,
                        userId: true,
                        user: {
                            select: { username: true }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Collect all mentioned user IDs
        const allMentionedIds = new Set<string>();
        comments.forEach((c: any) => {
            const ids = c.mentionedUserIds ? JSON.parse(c.mentionedUserIds) : [];
            ids.forEach((id: string) => allMentionedIds.add(id));
        });

        // Fetch mentioned users' details
        const mentionedUsers = await prisma.user.findMany({
            where: { id: { in: Array.from(allMentionedIds) } },
            select: { id: true, username: true, role: true }
        });

        // Create user map for quick lookup
        const userMap = new Map(mentionedUsers.map((u: any) => [u.id, u] as [string, any]));

        // Parse JSON fields and add mentionedUsers array
        const parsedComments = comments.map((c: typeof comments[number]) => {
            const mentionedIds = c.mentionedUserIds ? JSON.parse(c.mentionedUserIds) : [];
            return {
                ...c,
                structuredData: c.structuredData ? JSON.parse(c.structuredData) : null,
                readBy: c.readBy ? JSON.parse(c.readBy) : [],
                mentionedUserIds: mentionedIds,
                mentionedUsers: mentionedIds
                    .map((id: string) => userMap.get(id))
                    .filter((u: { id: string; username: string; role: string } | undefined) => u !== undefined)
            };
        });

        return NextResponse.json({ comments: parsedComments });

    } catch (error) {
        console.error('Get comments error:', error);
        return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
    }
}

// Helper function to update order comment stats cache
async function updateOrderCommentStats(orderId: string) {
    try {
        const comments = await prisma.comment.findMany({
            where: { orderId },
            select: {
                stepName: true
            }
        });

        // Group by stepName - only count total, unread is now per-user via /api/comments/unread-stats
        const statsByStep: Record<string, { total: number }> = {};

        comments.forEach((comment: typeof comments[number]) => {
            if (!statsByStep[comment.stepName]) {
                statsByStep[comment.stepName] = { total: 0 };
            }
            statsByStep[comment.stepName].total++;
        });

        // Update order
        await prisma.order.update({
            where: { id: orderId },
            data: {
                commentStats: JSON.stringify(statsByStep)
            }
        });

    } catch (error) {
        console.error('Update comment stats error:', error);
    }
}

