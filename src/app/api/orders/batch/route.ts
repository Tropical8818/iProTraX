import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { Order } from '@prisma/client';

interface StepUpdate {
    woId: string;
    step: string;
    status: string;
}

export async function PATCH(request: Request) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { updates, productId } = await request.json();

        if (!updates || !Array.isArray(updates) || updates.length === 0) {
            return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
        }

        if (!productId) {
            return NextResponse.json({ error: 'Product ID required' }, { status: 400 });
        }

        // Process batch updates in a transaction
        let successCount = 0;
        const errors: string[] = [];

        // Group updates by woId for efficiency
        const updatesByWoId = new Map<string, StepUpdate[]>();
        for (const update of updates as StepUpdate[]) {
            const existing = updatesByWoId.get(update.woId) || [];
            existing.push(update);
            updatesByWoId.set(update.woId, existing);
        }

        // Fetch all affected orders in one query
        const woIds = Array.from(updatesByWoId.keys());
        const allOrders = await prisma.order.findMany({
            where: {
                productId,
                woId: { in: woIds }
            }
        });

        // Create a map for quick lookup
        const orderMap = new Map<string, Order>(allOrders.map((o: Order) => [o.woId, o]));

        // Process all updates and prepare batch operations
        const orderUpdates: { id: string; data: string }[] = [];
        const logEntries: { action: string; details: string; userId: string; orderId: string; snapshot: string }[] = [];

        for (const [woId, stepUpdates] of updatesByWoId) {
            const order = orderMap.get(woId);
            if (!order) {
                errors.push(`Order ${woId} not found`);
                continue;
            }

            const currentData = JSON.parse(order.data);

            for (const update of stepUpdates) {
                const previousValue = currentData[update.step] || '';
                let newValue = update.status;

                // Handle different status types
                if (update.status === 'Reset') {
                    newValue = '';
                    delete currentData[update.step];
                } else if (['P', 'WIP', 'N/A', 'Hold', 'QN', 'DIFA'].includes(update.status)) {
                    currentData[update.step] = update.status;
                } else {
                    currentData[update.step] = update.status;
                }

                logEntries.push({
                    action: update.status,
                    details: JSON.stringify({
                        step: update.step,
                        previousValue,
                        newValue,
                        batchOperation: true
                    }),
                    userId: session.userId,
                    orderId: order.id,
                    snapshot: JSON.stringify({ woId: update.woId })
                });
            }

            orderUpdates.push({
                id: order.id,
                data: JSON.stringify(currentData)
            });
        }

        // Execute all updates in a transaction for consistency
        await prisma.$transaction(async (tx: typeof prisma) => {
            // Update all orders in parallel (chunked to prevent overwhelming DB)
            const CHUNK_SIZE = 50;
            for (let i = 0; i < orderUpdates.length; i += CHUNK_SIZE) {
                const chunk = orderUpdates.slice(i, i + CHUNK_SIZE);
                await Promise.all(chunk.map(update =>
                    tx.order.update({
                        where: { id: update.id },
                        data: { data: update.data }
                    })
                ));
            }

            // Create all logs in one batch operation
            if (logEntries.length > 0) {
                await tx.operationLog.createMany({
                    data: logEntries
                });
            }
        });

        successCount = orderUpdates.length;

        // Publish event (fire and forget)
        (async () => {
            try {
                const { redis } = await import('@/lib/redis');
                await redis.publish('system-updates', JSON.stringify({
                    type: 'ORDER_UPDATE',
                    productId,
                    batch: true
                }));
            } catch (e) {
                console.error('Redis batch publish error', e);
            }
        })();

        return NextResponse.json({
            success: true,
            count: successCount,
            total: updates.length,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        console.error('Batch update error:', error);
        const message = error instanceof Error ? error.message : 'Batch update failed';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
