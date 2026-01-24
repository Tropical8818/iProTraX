import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * API to migrate column names in existing order data
 * When a user renames a column in settings, this API updates all existing orders
 * to use the new column name.
 */
export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    try {
        const { productId, oldColumnName, newColumnName } = await request.json();

        if (!productId || !oldColumnName || !newColumnName) {
            return NextResponse.json({
                error: 'productId, oldColumnName, and newColumnName are required'
            }, { status: 400 });
        }

        if (oldColumnName === newColumnName) {
            return NextResponse.json({
                error: 'Old and new column names are the same'
            }, { status: 400 });
        }

        // Fetch all orders for this product
        const orders = await prisma.order.findMany({
            where: { productId }
        });

        let migratedCount = 0;

        for (const order of orders) {
            try {
                const data = JSON.parse(order.data);

                // Check if the old column name exists in this order's data
                if (data[oldColumnName] !== undefined) {
                    // Copy value to new key
                    data[newColumnName] = data[oldColumnName];

                    // Delete old key
                    delete data[oldColumnName];

                    // Update the order
                    await prisma.order.update({
                        where: { id: order.id },
                        data: { data: JSON.stringify(data) }
                    });

                    migratedCount++;
                }
            } catch (e) {
                console.error(`Error migrating order ${order.id}:`, e);
            }
        }

        return NextResponse.json({
            success: true,
            message: `Migrated ${migratedCount} orders from "${oldColumnName}" to "${newColumnName}"`,
            totalOrders: orders.length,
            migratedOrders: migratedCount
        });
    } catch (error) {
        console.error('Column migration error:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Failed to migrate columns'
        }, { status: 500 });
    }
}
