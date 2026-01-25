import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = request.nextUrl.searchParams;
    const orderId = searchParams.get('orderId');

    if (!orderId) {
        return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
    }

    try {
        // @ts-ignore
        const activeSessions = await prisma.stepProgress.findMany({
            where: {
                orderId,
                endTime: null
            }
        });

        // Filter for current user's active sessions (My Active Tasks)
        // @ts-ignore
        const myActiveSessions = (activeSessions as any[]).filter((s: any) => s.userId === session.userId);

        const sessionMap = myActiveSessions.reduce((acc: any, curr: any) => {
            acc[curr.stepName] = curr;
            return acc;
        }, {});

        return NextResponse.json(sessionMap);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
