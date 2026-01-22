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

        // We might want to update the total quantity on the order too?
        // But for now the order data is just a string 'WIP' or 'Done'.
        // We can keep the order status as WIP until explicitly marked Done?
        // Or if total quantity >= target, mark as Done?

        // Let's check target quantity
        const order = await prisma.order.findUnique({ where: { id: existingSession.orderId }, include: { product: true } });
        if (order) {
            const productConfig = JSON.parse(order.product.config);
            const targetQty = productConfig.stepQuantities?.[existingSession.stepName];

            if (targetQty) {
                // Calculate total completed including this one
                // @ts-ignore
                const allProgress = await prisma.stepProgress.findMany({
                    where: { orderId: existingSession.orderId, stepName: existingSession.stepName }
                });
                // @ts-ignore
                const totalCompleted = allProgress.reduce((sum: number, p: any) => sum + p.quantity, 0); // Note: updatedSession is already in DB? Yes.

                // Because we just updated the session, `allProgress` might include the OLD value if not careful with transaction?
                // Wait, `prisma.stepProgress.update` happened. So `findMany` will see new value.

                if (totalCompleted >= targetQty) {
                    // Auto-mark as Done?
                    // Let's leave it to the user or maybe auto-mark.
                    // The user plan said: "Visual indicator of Total Completed vs Target".
                    // Maybe auto-mark is nice.
                    // I'll auto-mark as Done if total >= target.

                    const currentData = JSON.parse(order.data);
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
                        await prisma.order.update({
                            where: { id: order.id },
                            data: { data: JSON.stringify(currentData) }
                        });
                        // Log
                        await prisma.operationLog.create({
                            data: {
                                action: 'Done', // System Auto-Complete
                                details: JSON.stringify({ step: existingSession.stepName, note: 'Auto-completed by quantity' }),
                                userId: session.userId,
                                orderId: order.id
                            }
                        });
                    }
                }
            }
        }

        return NextResponse.json(updatedSession);

    } catch (error) {
        console.error('Stop step error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
