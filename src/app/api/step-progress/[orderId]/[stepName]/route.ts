import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ orderId: string; stepName: string }> }
) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { orderId, stepName } = await params;
        const decodedStepName = decodeURIComponent(stepName);

        // @ts-ignore
        const progressRecords = await prisma.stepProgress.findMany({
            where: {
                orderId,
                stepName: decodedStepName
            },
            include: {
                user: {
                    select: { username: true }
                }
            },
            orderBy: {
                startTime: 'desc'
            }
        });

        // Find MY active session (current user's)
        // @ts-ignore
        const myActiveSession = progressRecords.find((p: any) => !p.endTime && p.userId === session.userId) || null;

        // Find OTHER users' active sessions (for display purposes)
        // @ts-ignore
        const otherActiveUsers = progressRecords
            .filter((p: any) => !p.endTime && p.userId !== session.userId)
            .map((p: any) => ({ username: p.user.username, startTime: p.startTime }));

        // @ts-ignore
        const totalQuantity = Math.round(progressRecords.reduce((sum: number, p: any) => sum + p.quantity, 0) * 1000) / 1000;

        // @ts-ignore
        const establishedRecord = progressRecords.find((p: any) => p.standardTime != null && p.standardTime > 0);
        // @ts-ignore
        const establishedStandardTime = establishedRecord?.standardTime || null;

        return NextResponse.json({
            history: progressRecords,
            myActiveSession,
            otherActiveUsers,
            totalQuantity,
            establishedStandardTime
        });

    } catch (error) {
        console.error('Get step progress error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
