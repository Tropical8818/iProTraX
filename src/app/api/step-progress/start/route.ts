import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        console.log('API Start: prisma keys:', Object.keys(prisma).filter((k: string) => !k.startsWith('_')));
        const body = await request.json();
        const { orderId, stepName } = body;
        let { standardTime } = body;

        if (!orderId || !stepName) {
            console.error('Start session error: Missing fields', { orderId, stepName });
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // If standardTime not provided, try to find established one
        if (!standardTime) {
            // @ts-ignore
            const established = await prisma.stepProgress.findFirst({
                where: {
                    orderId,
                    stepName, // Should we match exact stepName? Yes.
                    standardTime: { not: null }
                },
                select: { standardTime: true }
            });
            // @ts-ignore
            if (established?.standardTime) {
                // @ts-ignore
                standardTime = established.standardTime;
            }
        }

        // Check for existing active session for this user
        // @ts-ignore
        const existingSession = await prisma.stepProgress.findFirst({
            where: {
                orderId,
                stepName,
                userId: session.userId,
                endTime: null
            }
        });

        if (existingSession) {
            return NextResponse.json(existingSession);
        }

        // Create new session
        // @ts-ignore
        const newSession = await prisma.stepProgress.create({
            data: {
                orderId,
                stepName,
                userId: session.userId,
                standardTime, // Save the manual input
                startTime: new Date()
            }
        });

        // Also update the order step status to WIP if needed?
        // Let's explicitly set it to WIP
        // We first need to fetch the order data
        const order = await prisma.order.findUnique({ where: { id: orderId } });
        if (order) {
            const currentData = JSON.parse(order.data);
            if (currentData[stepName] !== 'WIP' && currentData[stepName] !== 'Done') {
                currentData[stepName] = 'WIP';
                await prisma.order.update({
                    where: { id: orderId },
                    data: { data: JSON.stringify(currentData) }
                });

                // Log action
                await prisma.operationLog.create({
                    data: {
                        action: 'Start',
                        details: JSON.stringify({ step: stepName, status: 'WIP' }),
                        userId: session.userId,
                        orderId: orderId
                    }
                });
            }
        }

        return NextResponse.json(newSession);

    } catch (error: any) {
        console.error('Start step error details:', error);
        // @ts-ignore
        const models = Object.keys(prisma).filter((k: string) => !k.startsWith('$') && !k.startsWith('_')).join(', ');
        return NextResponse.json({
            error: `Internal Server Error: ${error?.message || 'Unknown'}. Models found: ${models}`
        }, { status: 500 });
    }
}
