import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { startOfDay, subDays, subMonths } from 'date-fns';

export async function POST(request: Request) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { source, groupBy, metric, timeRange, filters = {} } = body;

        // 1. Determine Date Filter
        let dateFilter: any = {};
        const now = new Date();

        if (timeRange === 'today') {
            dateFilter = { gte: startOfDay(now) };
        } else if (timeRange === '7d') {
            dateFilter = { gte: subDays(now, 7) };
        } else if (timeRange === '30d') {
            dateFilter = { gte: subDays(now, 30) };
        } else if (timeRange === '3m') {
            dateFilter = { gte: subMonths(now, 3) };
        }
        // 'all' = no filter

        // 2. Build Where Clause
        const where: any = { ...filters };

        if (source === 'orders') {
            if (timeRange !== 'all') where.updatedAt = dateFilter;
            // Orders are "Live", so typicaly we query current state.
            // If analyzing "Created Orders", use createdAt.
            // But usually "Status Distribution" is snapshot.
            // For now, let's assume we filter by updatedAt for activity? 
            // Or usually we don't filter orders by date unless analyzing throughput?
            // "Current Status" implies NO date filter usually.
            // Let's assume frontend passes 'all' for Status Distribution.
        } else {
            // Logs
            if (timeRange !== 'all') where.timestamp = dateFilter;
        }

        // 3. Execute Query
        let result: { name: string; value: number }[] = [];

        console.log(`[Analytics] Query: Source=${source}, GroupBy=${groupBy}, Time=${timeRange}, Filters=${JSON.stringify(filters)}`);

        if (source === 'orders') {
            // Group By on Order table
            // Allowed fields: 'status', 'priority', 'productId'
            // Prisma groupBy requires these to be scalar fields.
            // 'step' is inside JSON 'data', so Prisma CANNOT groupBy it directly.
            // Valid GroupBy fields: status, priority.

            if (groupBy === 'step') {
                // Special handling for Step distribution?
                // Step data is dynamic. We must fetch all and aggregate manually?
                // Or use `status` field if it mirrors something?
                // No, `status` field in schema is generic.
                // If user wants "Orders by Step", we might need to iterate.
                // Constraint: For V1, restricted to schema fields.
                // Let's stick to `status`, `priority`.

                // If groupBy IS supported:
                const groupResult = await prisma.order.groupBy({
                    by: [groupBy],
                    where,
                    _count: true,
                });

                result = groupResult.map(item => ({
                    name: item[groupBy] || 'N/A',
                    value: item._count
                }));
            } else {
                // Fallback or generic
                const groupResult = await prisma.order.groupBy({
                    by: [groupBy as any], // Cast for flexibility, caught by try/catch if invalid
                    where,
                    _count: true,
                });
                result = groupResult.map(item => ({
                    name: (item as any)[groupBy] || 'N/A',
                    value: item._count
                }));
            }

        } else if (source === 'logs') {
            // Group By on OperationLog table
            // Allowed fields: 'action', 'operatorId', 'step', 'orderId'

            const groupResult = await prisma.operationLog.groupBy({
                by: [groupBy as any],
                where,
                _count: true,
            });

            // Map operatorId to username if needed? 
            // For now return raw ID. Frontend can perhaps map if it has user list.
            result = groupResult.map(item => ({
                name: (item as any)[groupBy] || 'Unknown',
                value: item._count
            }));
        }

        console.log(`[Analytics] Result count: ${result.length}`);
        return NextResponse.json({ data: result });

    } catch (error) {
        console.error('[Analytics] Query Error:', error);
        return NextResponse.json({ error: 'Failed to execute query' }, { status: 500 });
    }
}
