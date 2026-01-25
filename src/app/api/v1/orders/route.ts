import { NextRequest } from 'next/server';
import { validateApiKey, hasPermission, apiError, apiSuccess } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/orders
 * List orders with optional filtering.
 * 
 * Query params:
 * - product: Filter by product ID
 * - status: Filter by status (e.g., "HOLD", "QN")
 * - limit: Max results (default 50, max 200)
 * - offset: Pagination offset
 */
export async function GET(request: NextRequest) {
    const auth = await validateApiKey(request);
    if (!auth.valid) {
        return apiError(auth.error || 'Unauthorized', 401);
    }

    if (!hasPermission(auth.permissions || [], 'orders:read')) {
        return apiError('Insufficient permissions', 403);
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('product');
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    try {
        const where: any = {};
        if (productId) where.productId = productId;
        if (status) where.status = { contains: status, mode: 'insensitive' };

        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where,
                take: limit,
                skip: offset,
                orderBy: { updatedAt: 'desc' },
                include: {
                    product: { select: { id: true, name: true, slug: true } }
                }
            }),
            prisma.order.count({ where })
        ]);

        // Parse JSON data field for each order
        const formattedOrders = orders.map(order => ({
            id: order.id,
            woId: order.woId,
            productId: order.productId,
            productName: order.product.name,
            productSlug: order.product.slug,
            status: order.status,
            priority: order.priority,
            data: JSON.parse(order.data || '{}'),
            createdAt: order.createdAt.toISOString(),
            updatedAt: order.updatedAt.toISOString()
        }));

        return apiSuccess({
            orders: formattedOrders,
            pagination: {
                total,
                limit,
                offset,
                hasMore: offset + orders.length < total
            }
        });
    } catch (error) {
        console.error('[API/Orders] Error:', error);
        return apiError('Failed to fetch orders', 500);
    }
}
