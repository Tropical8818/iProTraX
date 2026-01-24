import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

/**
 * POST /api/messages/read-all
 * Mark ALL unread messages as read for the current user
 */
export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const userId = session.userId;

        // 1. Find all relevant comments (same logic as GET /api/messages/my)
        const comments = await prisma.comment.findMany({
            where: {
                OR: [
                    { replyTo: { userId: userId } },
                    { mentionedUserIds: { contains: userId } }
                ]
            },
            select: {
                id: true,
                readBy: true,
                orderId: true,
                stepName: true
            }
        });

        // 2. Filter for unread ones
        const unreadComments = comments.filter(c => {
            const readBy = c.readBy ? JSON.parse(c.readBy) : [];
            return !readBy.includes(userId);
        });

        if (unreadComments.length === 0) {
            return NextResponse.json({ success: true, count: 0 });
        }

        // 3. Update them one by one (Promise.all)
        // We perform individual updates to ensure JSON integrity and trigger potential hooks if any
        // (Though bulk operations are better, JSON array manipulation requires this in prisma usually)

        let updatedCount = 0;
        const updates = unreadComments.map(async (comment) => {
            const readBy = comment.readBy ? JSON.parse(comment.readBy) : [];
            // Generic check again just in case
            if (!readBy.includes(userId)) {
                readBy.push(userId);

                await prisma.comment.update({
                    where: { id: comment.id },
                    data: { readBy: JSON.stringify(readBy) }
                });
                updatedCount++;
            }
        });

        await Promise.all(updates);

        // 4. Update stats for affected orders (optional optimization: group by order)
        // Use a set to avoid duplicate updates
        const orderIds = new Set(unreadComments.map(c => c.orderId));
        for (const orderId of orderIds) {
            await updateOrderCommentStats(orderId);
        }

        return NextResponse.json({ success: true, count: updatedCount });

    } catch (error) {
        console.error('Mark all read error:', error);
        return NextResponse.json({ error: 'Failed to mark all as read' }, { status: 500 });
    }
}

// Helper: Update order stats (Copied/Shared logic)
// Ideally this helper should be in a lib, but for now duplicating to keep file self-contained as requested by established patterns
async function updateOrderCommentStats(orderId: string) {
    try {
        const comments = await prisma.comment.findMany({
            where: { orderId },
            select: { stepName: true, readBy: true }
        });

        const statsByStep: Record<string, { total: number; unread: number }> = {};

        comments.forEach(comment => {
            if (!statsByStep[comment.stepName]) {
                statsByStep[comment.stepName] = { total: 0, unread: 0 };
            }
            statsByStep[comment.stepName].total++;
            // Note: 'unread' in stats usually implies 'unread by ANYONE involved' or specific logic? 
            // In the main app logic `updateOrderCommentStats` usually checks if *current user* hasn't read it?
            // Actually, the stats stored in `order.commentStats` is generic. `order.userUnreadStats` is per user?
            // The stored `commentStats` usually counts TOTAL comments. 
            // The UNREAD counts shown in UI are often calculated on the fly or stored in a separate user-specific field?
            // 
            // Checking previous file `api/messages/[id]/read/route.ts`...
            // It calls `updateOrderCommentStats(comment.orderId)`.
            // Inside that function it counts total. It DOESN'T seem to calculate unread for everyone.
            // Wait, looking at lines 60-70 of `read/route.ts`:
            // `statsByStep[comment.stepName] = { total: 0, unread: 0 };`
            // `statsByStep[comment.stepName].total++;`
            // It does NOT increment unread?
            // So `order.commentStats` only tracks totals?
            // Then unread indicators on Dashboard need dynamic calculation?
            //
            // Correct. The dashboard component likely fetches user-specific unread stats separately or calculates them.
            // BUT, `MessageNotification` relies on `api/messages/my` which calculates unread on the fly.
            // 
            // So calling `updateOrderCommentStats` here updates the `total` which shouldn't change, 
            // BUT maybe it's good practice to ensure consistency? 
            // Actually if we only change `readBy`, the `total` count doesn't change.
            // So technically we don't need to call updateOrderCommentStats if strictly updating read status.
            // However, if `userUnreadStats` is a thing...
            // UsePlannerTable code: `(order as any).userUnreadStats?.[step]?.unread`
            // This suggests there is a field.
            // If we don't update that field in the DB, the Dashboard bubbles might not clear immediately until refetch?
            // Refetch logic in Dashboard usually fetches `orders` again. 
            // The `orders` endpoints usually populate `userUnreadStats` dynamically based on session user.
            // So we just need to ensure the `readBy` column is updated.
        });

        // So we might skip this step if we are confident, but to be safe and match the single-read endpoint behavior:
        await prisma.order.update({
            where: { id: orderId },
            data: { commentStats: JSON.stringify(statsByStep) }
        });
    } catch (error) {
        console.error('Update comment stats error:', error);
    }
}
