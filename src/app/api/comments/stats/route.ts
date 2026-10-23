import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

/**
 * GET /api/comments/stats?orderId=xxx&stepName=xxx
 * Get comment statistics for a specific step
 */
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

        // Calculate total and per-user unread count dynamically
        const comments = await prisma.comment.findMany({
            where: { orderId, stepName },
            select: { readBy: true, mentionedUserIds: true }
        });

        const total = comments.length;
        const unread = comments.filter((c: any) => {
            const mentionedList = c.mentionedUserIds ? JSON.parse(c.mentionedUserIds) : [];
            const readByList = c.readBy ? JSON.parse(c.readBy) : [];
            return mentionedList.includes(session.userId) && !readByList.includes(session.userId);
        }).length;

        return NextResponse.json({ total, unread });

    } catch (error) {
        console.error('Get comment stats error:', error);
        return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }
}
