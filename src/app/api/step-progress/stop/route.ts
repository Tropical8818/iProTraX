import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { progressId, quantity } = await request.json();

        if (!progressId || quantity === undefined) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Verify session belongs to user and is active
        // @ts-ignore
        const existingSession = await prisma.stepProgress.findUnique({
            where: { id: progressId }
        });

        if (!existingSession) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        if (existingSession.userId !== session.userId) {
            return NextResponse.json({ error: 'Unauthorized access to session' }, { status: 403 });
        }

        if (existingSession.endTime) {
            return NextResponse.json({ error: 'Session already completed' }, { status: 400 });
        }

        // Update session
        // @ts-ignore
        const updatedSession = await prisma.stepProgress.update({
            where: { id: progressId },
            data: {
                endTime: new Date(),
                quantity: parseFloat(quantity)
            }
        });

        const order = await prisma.order.findUnique({ where: { id: existingSession.orderId }, include: { product: true } });
        if (order) {
            const currentData = JSON.parse(order.data);
            let isOrderDirty = false;
            const logEntries: any[] = [];

            const productConfig = JSON.parse(order.product.config);
            const targetQty = productConfig.stepQuantities?.[existingSession.stepName];

            // 1. Check Auto-Complete (Target Quantity)
            if (targetQty) {
                // Calculate total completed including this one
                // @ts-ignore
                const allProgress = await prisma.stepProgress.findMany({
                    where: { orderId: existingSession.orderId, stepName: existingSession.stepName }
                });
                // @ts-ignore
                const totalCompleted = allProgress.reduce((sum: number, p: any) => sum + p.quantity, 0);

                if (totalCompleted >= targetQty) {
                    // Auto-mark as Done with Timestamp
                    const now = new Date();
                    const year = now.getFullYear();
                    const month = String(now.getMonth() + 1).padStart(2, '0');
                    const day = String(now.getDate()).padStart(2, '0');
                    const hour = String(now.getHours()).padStart(2, '0');
                    const minute = String(now.getMinutes()).padStart(2, '0');

                    const timestamp = `${year}-${month}-${day} ${hour}:${minute}`;

                    if (currentData[existingSession.stepName] !== timestamp) {
                        currentData[existingSession.stepName] = timestamp;
                        isOrderDirty = true;

                        logEntries.push({
                            action: 'Done', // System Auto-Complete
                            details: JSON.stringify({ step: existingSession.stepName, note: 'Auto-completed by quantity' }),
                            userId: session.userId,
                            orderId: order.id
                        });
                    }
                }
            }

            // 2. Check Auto-Flow (Zero-Wait)
            const currentStepStatus = currentData[existingSession.stepName];
            // Only trigger if current step is completed (Timestamp or Done)
            const isCompleted = currentStepStatus && currentStepStatus !== 'WIP' && currentStepStatus !== 'P' && currentStepStatus !== 'Hold' && currentStepStatus !== 'QN';

            if (isCompleted && productConfig.schedulingConfig?.autoFlow) {
                const steps = productConfig.steps || [];
                const currentStepIndex = steps.indexOf(existingSession.stepName);

                if (currentStepIndex !== -1 && currentStepIndex < steps.length - 1) {
                    for (let i = currentStepIndex + 1; i < steps.length; i++) {
                        const nextStep = steps[i];
                        const nextStepStatus = currentData[nextStep];

                        // Skip if explicitly marked N/C (Not Applicable)
                        if (nextStepStatus === 'N/C' || nextStepStatus === 'N/A') {
                            continue;
                        }

                        // If occupied (and not P), skip
                        if (nextStepStatus && nextStepStatus !== 'P' && nextStepStatus !== '') {
                            continue;
                        }

                        // Found an empty or 'P' slot
                        if (!nextStepStatus || nextStepStatus === '') {
                            currentData[nextStep] = 'P';
                            isOrderDirty = true;

                            logEntries.push({
                                action: 'Auto-Schedule',
                                details: JSON.stringify({
                                    triggerStep: existingSession.stepName,
                                    targetStep: nextStep,
                                    note: 'Auto-Flow (Zero-Wait)'
                                }),
                                userId: session.userId,
                                orderId: order.id
                            });
                            break; // Stop after scheduling the first available step
                        }

                        // If it was already 'P', we stop because it's already scheduled.
                        if (nextStepStatus === 'P') {
                            break;
                        }
                    }
                }
            }

            // 3. Commit Updates if Dirty
            if (isOrderDirty) {
                await prisma.$transaction([
                    prisma.order.update({
                        where: { id: order.id },
                        data: { data: JSON.stringify(currentData) }
                    }),
                    ...logEntries.map(log => prisma.operationLog.create({ data: log }))
                ]);
            }
        }

        return NextResponse.json(updatedSession);

    } catch (error) {
        console.error('Stop step error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
