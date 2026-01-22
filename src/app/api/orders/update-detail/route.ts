import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { woId, field, value, productId } = body;

        if (!woId || !field || !productId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Find the order
        const order = await prisma.order.findUnique({
            where: {
                productId_woId: {
                    productId,
                    woId
                }
            }
        });

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        const currentData = JSON.parse(order.data);
        const previousValue = currentData[field];

        // Update field
        currentData[field] = value;

        // Persist to DB
        await prisma.order.update({
            where: { id: order.id },
            data: {
                data: JSON.stringify(currentData)
            }
        });

        console.log(`[Edit] Updated ${woId} [${field}] to "${value}"`);

        // Publish real-time update
        try {
            const { redis } = await import('@/lib/redis');
            await redis.publish('system-updates', JSON.stringify({
                type: 'ORDER_UPDATE',
                productId,
                woId,
                field,
                value
            }));
        } catch (rErr) {
            console.error('Redis publish error:', rErr);
        }

        return NextResponse.json({ success: true, message: 'Detail updated successfully' });
    } catch (error) {
        console.error('Update detail error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
