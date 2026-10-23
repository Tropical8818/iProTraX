import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatToFullTimestamp } from '@/lib/date-utils';
import { NotificationService } from '@/lib/services/notification-service';

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id: woId } = await params;
        const { step, status, productId } = await request.json();

        if (!step || !status || !productId) {
            return NextResponse.json({ error: 'Step, status, and product ID are required' }, { status: 400 });
        }

        // Find the order
        let order;
        // Check if woId looks like a UUID
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(woId);

        if (isUuid) {
            order = await prisma.order.findUnique({
                where: { id: woId }
            });
        }

        if (!order) {
            order = await prisma.order.findUnique({
                where: {
                    productId_woId: {
                        productId,
                        woId
                    }
                }
            });
        }

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        const currentData = JSON.parse(order.data);
        const previousValue = currentData[step] || '';
        let newValue = status;


        if (status === 'Reset') {
            newValue = '';
            delete currentData[step];
        } else if (status === 'Done') {
            // "Done" generates a timestamp in format: YYYY-MM-DD HH:mm (Backend stores full date now)
            // Frontend will handle abbreviation
            newValue = formatToFullTimestamp(new Date());
            currentData[step] = newValue;
        } else if (['P', 'WIP', 'N/A', 'Hold', 'QN', 'DIFA'].includes(status)) {
            // Status markers are kept as-is
            currentData[step] = status;
            newValue = status;
        } else {
            // Fallback: anything else is saved as-is (e.g., manual edits)
            currentData[step] = status;
            newValue = status;
        }

        // Get product name for notifications
        const product = await prisma.product.findUnique({ where: { id: productId } });
        const productName = product?.name || 'Unknown';

        // Transaction: Update Order + Create Log
        const [updatedOrder] = await prisma.$transaction([
            prisma.order.update({
                where: { id: order.id },
                data: {
                    data: JSON.stringify(currentData)
                }
            }),
            prisma.operationLog.create({
                data: {
                    action: status,
                    details: JSON.stringify({
                        step,
                        previousValue,
                        newValue
                    }),
                    userId: session.userId,
                    orderId: order.id,
                    snapshot: JSON.stringify({
                        woId,
                        productName
                    })
                }
            })
        ]);

        // Auto-notify supervisors & admins when Hold or QN is set
        if (status === 'Hold' || status === 'QN') {
            try {
                // Get all approved supervisors and admins (excluding the user who triggered it)
                const supervisors = await prisma.user.findMany({
                    where: {
                        status: 'approved',
                        role: { in: ['admin', 'supervisor'] }
                    },
                    select: { id: true }
                });

                let recipientIds = supervisors
                    .map((s: { id: string }) => s.id)
                    .filter((id: string) => id !== session.userId);

                // Fallback: if the actor is the only supervisor/admin, notify all other approved non-kiosk users
                if (recipientIds.length === 0) {
                    const otherUsers = await prisma.user.findMany({
                        where: {
                            status: 'approved',
                            role: { not: 'kiosk' },
                            id: { not: session.userId }
                        },
                        select: { id: true }
                    });
                    recipientIds = otherUsers.map((u: { id: string }) => u.id);
                }

                // Get current user's username
                const currentUser = await prisma.user.findUnique({
                    where: { id: session.userId },
                    select: { username: true }
                });

                // Create notification comment
                const alertMessage = status === 'Hold'
                    ? `🟠 HOLD Alert: WO ${woId} marked as HOLD at step "${step}" by ${currentUser?.username || 'Unknown'}`
                    : `🔴 QN Alert: WO ${woId} marked as QN at step "${step}" by ${currentUser?.username || 'Unknown'}`;

                await prisma.comment.create({
                    data: {
                        content: alertMessage,
                        category: status === 'Hold' ? 'MATERIAL_SHORTAGE' : 'QUALITY_ISSUE',
                        triggeredStatus: status,
                        userId: session.userId,
                        orderId: order.id,
                        stepName: step,
                        readBy: JSON.stringify([session.userId]),
                        mentionedUserIds: JSON.stringify(recipientIds),
                        structuredData: JSON.stringify({
                            type: status === 'Hold' ? 'hold_alert' : 'qn_alert',
                            mentionGroup: '@Supervisor',
                            woId,
                            step,
                            productName,
                            setBy: currentUser?.username
                        })
                    }
                });

                console.log(`[Notification] ${status} alert sent to ${recipientIds.length} recipients for WO ${woId}`);
            } catch (notifyError) {
                // Don't fail the main operation if notification fails
                console.error('Failed to send supervisor notification:', notifyError);
            }
        }

        // Webhook Integrations (moved outside Hold/QN block so on_done and on_step_update work)
        try {
            const notifService = NotificationService.getInstance();
            const operator = session.username || 'Unknown';
            const details = {
                step,
                previousValue,
                newValue: status
            };

            const payload = {
                orderId: woId,
                step,
                status,
                productName,
                operator,
                details
            };

            if (status === 'Hold') {
                void notifService.send('on_hold', payload);
            } else if (status === 'QN') {
                void notifService.send('on_qn', payload);
            } else if (status === 'Done') {
                void notifService.send('on_done', payload);
            } else {
                void notifService.send('on_step_update', payload);
            }
        } catch (webhookErr) {
            console.error('[Webhook] Error triggering webhooks:', webhookErr);
        }


        // Publish real-time update
        try {
            const { redis } = await import('@/lib/redis');
            await redis.publish('system-updates', JSON.stringify({
                type: 'ORDER_UPDATE',
                productId,
                woId,
                action: status
            }));
        } catch (rErr) {
            console.error('Redis publish error:', rErr);
        }

        // --- Auto-Flow (Zero-Wait) Logic ---
        if (status === 'Done' && product) {
            try {
                const productConfig = JSON.parse(product.config || '{}');

                if (productConfig.schedulingConfig?.autoFlow) {
                    const steps = productConfig.steps || [];
                    const currentStepIndex = steps.indexOf(step);

                    if (currentStepIndex !== -1 && currentStepIndex < steps.length - 1) {
                        // We need the LATEST data, which involves the update we just made.
                        // We can use `currentData` which has the update.
                        const orderData = { ...currentData };

                        let foundNext = false;
                        for (let i = currentStepIndex + 1; i < steps.length; i++) {
                            const nextStep = steps[i];
                            const nextStepStatus = orderData[nextStep];

                            // Skip N/C
                            if (nextStepStatus === 'N/C' || nextStepStatus === 'N/A') {
                                continue;
                            }

                            // If occupied (and not P), skip
                            if (nextStepStatus && nextStepStatus !== 'P' && nextStepStatus !== '') {
                                continue;
                            }

                            // Empty or P -> Schedule
                            if (!nextStepStatus || nextStepStatus === '') {
                                orderData[nextStep] = 'P';
                                foundNext = true;

                                await prisma.order.update({
                                    where: { id: order.id },
                                    data: { data: JSON.stringify(orderData) }
                                });

                                await prisma.operationLog.create({
                                    data: {
                                        action: 'Auto-Schedule',
                                        details: JSON.stringify({
                                            triggerStep: step,
                                            targetStep: nextStep,
                                            note: 'Auto-Flow (Zero-Wait)'
                                        }),
                                        userId: session.userId,
                                        orderId: order.id
                                    }
                                });
                                break;
                            }

                            // If P, stop
                            if (nextStepStatus === 'P') {
                                break;
                            }
                        }
                    }
                }
            } catch (afError) {
                console.error('Auto-Flow error:', afError);
            }
        }

        return NextResponse.json({ success: true, order: { ...updatedOrder, ...currentData } });
    } catch (error) {
        console.error('Update Step Error:', error);
        return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
    }
}

