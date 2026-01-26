import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/step-progress/my-active
// Returns all active sessions for the current user across all orders
export async function GET() {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // @ts-ignore
        const myActiveSessions = await prisma.stepProgress.findMany({
            where: {
                userId: session.userId,
                endTime: null
            },
            include: {
                order: {
                    select: {
                        woId: true,
                        data: true,
                        product: {
                            select: { name: true, config: true }
                        }
                    }
                }
            },
            orderBy: {
                startTime: 'desc'
            }
        });

        // Get step quantities from product config
        const stepQuantitiesMap: Record<string, Record<string, { qty: number; unit: string }>> = {};

        // Format response with order info
        const result = await Promise.all(myActiveSessions.map(async (s: any) => {
            let orderData: any = {};
            try {
                orderData = JSON.parse(s.order.data);
            } catch { }

            // Get completed quantity for this step
            // @ts-ignore
            const stepProgress = await prisma.stepProgress.findMany({
                where: {
                    orderId: s.orderId,
                    stepName: s.stepName,
                    endTime: { not: null }
                },
                select: { quantity: true }
            });
            const completedQty = stepProgress.reduce((sum: number, p: any) => sum + (p.quantity || 0), 0);

            // Parse product config for step target
            let targetQty = 0;
            let unit = '';
            try {
                const productConfig = JSON.parse(s.order.product.config || '{}');
                const stepConfig = productConfig.stepQuantities?.[s.stepName];
                if (stepConfig) {
                    targetQty = stepConfig.qty || 0;
                    unit = stepConfig.unit || '';
                }
            } catch { }

            return {
                id: s.id,
                orderId: s.orderId,
                woId: s.order.woId,
                orderName: orderData['WO ID'] || orderData['Order'] || s.order.woId,
                stepName: s.stepName,
                startTime: s.startTime,
                productName: s.order.product.name,
                standardTime: s.standardTime,
                completedQty: Math.round(completedQty * 1000) / 1000,
                targetQty,
                unit
            };
        }));

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('My active sessions error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
