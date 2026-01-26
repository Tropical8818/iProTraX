import { NextRequest } from 'next/server';
import { validateApiKey, hasPermission, apiError, apiSuccess } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

interface RouteContext {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/orders/:id
 * Get single order with all details.
 */
export async function GET(request: NextRequest, context: RouteContext) {
    const auth = await validateApiKey(request);
    if (!auth.valid) {
        return apiError(auth.error || 'Unauthorized', 401);
    }

    if (!hasPermission(auth.permissions || [], 'orders:read')) {
        return apiError('Insufficient permissions', 403);
    }

    const { id } = await context.params;

    try {
        const order = await prisma.order.findUnique({
            where: { id },
            include: {
                product: { select: { id: true, name: true, slug: true, config: true } },
                comments: {
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                    include: { user: { select: { id: true, username: true } } }
                },
                stepProgress: {
                    orderBy: { startTime: 'desc' },
                    include: { user: { select: { id: true, username: true } } }
                },
                logs: {
                    orderBy: { timestamp: 'desc' },
                    take: 50
                }
            }
        });

        if (!order) {
            return apiError('Order not found', 404);
        }

        // Parse product config for step definitions
        const productConfig = JSON.parse(order.product.config || '{}');

        return apiSuccess({
            order: {
                id: order.id,
                woId: order.woId,
                productId: order.productId,
                productName: order.product.name,
                productSlug: order.product.slug,
                status: order.status,
                priority: order.priority,
                data: JSON.parse(order.data || '{}'),
                steps: productConfig.steps || [],
                comments: order.comments.map((c: any) => ({
                    id: c.id,
                    content: c.content,
                    stepName: c.stepName,
                    category: c.category,
                    user: c.user.username,
                    createdAt: c.createdAt.toISOString()
                })),
                stepProgress: order.stepProgress.map((sp: any) => ({
                    stepName: sp.stepName,
                    startTime: sp.startTime.toISOString(),
                    endTime: sp.endTime?.toISOString(),
                    quantity: sp.quantity,
                    operator: sp.user.username
                })),
                recentLogs: order.logs.map((log: any) => ({
                    action: log.action,
                    details: JSON.parse(log.details || '{}'),
                    timestamp: log.timestamp.toISOString()
                })),
                createdAt: order.createdAt.toISOString(),
                updatedAt: order.updatedAt.toISOString()
            }
        });
    } catch (error) {
        console.error('[API/Orders/:id] Error:', error);
        return apiError('Failed to fetch order', 500);
    }
}

/**
 * PATCH /api/v1/orders/:id
 * Update order status or step.
 * 
 * Body: { status?: string, priority?: string, data?: object }
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
    const auth = await validateApiKey(request);
    if (!auth.valid) {
        return apiError(auth.error || 'Unauthorized', 401);
    }

    if (!hasPermission(auth.permissions || [], 'orders:write')) {
        return apiError('Insufficient permissions', 403);
    }

    const { id } = await context.params;

    try {
        const body = await request.json();

        // Validate order exists
        const existing = await prisma.order.findUnique({ where: { id } });
        if (!existing) {
            return apiError('Order not found', 404);
        }

        const updates: any = {};

        if (body.status !== undefined) {
            updates.status = body.status;
        }

        if (body.priority !== undefined) {
            updates.priority = body.priority;
        }

        if (body.data !== undefined) {
            // Merge with existing data
            const existingData = JSON.parse(existing.data || '{}');
            updates.data = JSON.stringify({ ...existingData, ...body.data });
        }

        if (Object.keys(updates).length === 0) {
            return apiError('No valid fields to update', 400);
        }

        const updated = await prisma.order.update({
            where: { id },
            data: updates
        });

        // Log the API update
        await prisma.operationLog.create({
            data: {
                action: 'API_Update',
                orderId: id,
                details: JSON.stringify({
                    source: 'API v1',
                    keyId: auth.keyId,
                    changes: updates
                })
            }
        });

        return apiSuccess({
            order: {
                id: updated.id,
                woId: updated.woId,
                status: updated.status,
                priority: updated.priority,
                updatedAt: updated.updatedAt.toISOString()
            },
            message: 'Order updated successfully'
        });
    } catch (error) {
        console.error('[API/Orders/:id PATCH] Error:', error);
        return apiError('Failed to update order', 500);
    }
}
