import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

/**
 * GET /api/messages/my
 * Get messages relevant to the current user (inbox)
 */
export async function GET(req: NextRequest) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const userId = session.userId;

        // Find comments relevant to this user (newest first):
        // 1. Replies to their comments
        // 2. Mentions of them
        const comments = await prisma.comment.findMany({
            where: {
                OR: [
                    // Replies to my comments
                    {
                        replyTo: {
                            userId: userId
                        }
                    },
                    // Comments mentioning me
                    {
                        mentionedUserIds: {
                            contains: userId
                        }
                    }
                ]
            },
            include: {
                user: { select: { username: true, role: true } },
                order: { select: { woId: true, productId: true, product: { select: { name: true } } } }
            },
            orderBy: { createdAt: 'desc' },
            take: 200
        });

        const parsedMessages = comments.map((msg: any) => {
            const readBy = msg.readBy ? JSON.parse(msg.readBy) : [];
            const isUnread = !readBy.includes(userId);

            return {
                ...msg,
                readBy,
                mentionedUserIds: msg.mentionedUserIds ? JSON.parse(msg.mentionedUserIds) : [],
                structuredData: msg.structuredData ? JSON.parse(msg.structuredData) : null,
                isUnread
            };
        });

        const unreadMessages = parsedMessages.filter((m: any) => m.isUnread);
        const recentReadMessages = parsedMessages.filter((m: any) => !m.isUnread).slice(0, 10);

        // Show all unread messages first (newest first), followed by recent read history
        const combinedMessages = [...unreadMessages, ...recentReadMessages].slice(0, 30);
        const unreadCount = unreadMessages.length;

        return NextResponse.json({
            total: combinedMessages.length,
            unreadCount,
            messages: combinedMessages
        });

    } catch (error) {
        console.error('Get my messages error:', error);
        return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }
}
