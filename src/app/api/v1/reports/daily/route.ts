import { NextRequest } from 'next/server';
import { validateApiKey, hasPermission, apiError, apiSuccess } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/reports/daily
 * Get daily production summary.
 * 
 * Query params:
 * - date: Date in YYYY-MM-DD format (default: today)
 * - product: Optional product ID filter
 */
export async function GET(request: NextRequest) {
    const auth = await validateApiKey(request);
    if (!auth.valid) {
        return apiError(auth.error || 'Unauthorized', 401);
    }

    if (!hasPermission(auth.permissions || [], 'reports:read')) {
        return apiError('Insufficient permissions', 403);
    }

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date');
    const productId = searchParams.get('product');

    // Parse date or use today
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    try {
        // Build filters
        const orderWhere: any = {};
        const logWhere: any = {
            timestamp: { gte: startOfDay, lte: endOfDay }
        };

        if (productId) {
            orderWhere.productId = productId;
        }

        // Get orders updated today
        const ordersUpdatedToday = await prisma.order.count({
            where: {
                ...orderWhere,
                updatedAt: { gte: startOfDay, lte: endOfDay }
            }
        });

        // Get completed orders (status contains "DONE" or "COMPLETE")
        const completedToday = await prisma.order.count({
            where: {
                ...orderWhere,
                status: { contains: 'DONE', mode: 'insensitive' },
                updatedAt: { gte: startOfDay, lte: endOfDay }
            }
        });

        // Get holds raised today
        const holdsToday = await prisma.operationLog.count({
            where: {
                ...logWhere,
                action: { contains: 'Hold', mode: 'insensitive' }
            }
        });

        // Get QN issues raised today
        const qnToday = await prisma.operationLog.count({
            where: {
                ...logWhere,
                action: { contains: 'QN', mode: 'insensitive' }
            }
        });

        // Get step progress today
        const stepProgress = await prisma.stepProgress.groupBy({
            by: ['stepName'],
            where: {
                startTime: { gte: startOfDay, lte: endOfDay }
            },
            _count: { id: true },
            _sum: { quantity: true }
        });

        // Get active operators today
        const activeOperators = await prisma.stepProgress.findMany({
            where: {
                startTime: { gte: startOfDay, lte: endOfDay }
            },
            select: { userId: true },
            distinct: ['userId']
        });

        return apiSuccess({
            report: {
                date: targetDate.toISOString().split('T')[0],
                summary: {
                    ordersUpdated: ordersUpdatedToday,
                    ordersCompleted: completedToday,
                    holdsRaised: holdsToday,
                    qnIssues: qnToday,
                    activeOperators: activeOperators.length
                },
                stepBreakdown: stepProgress.map(sp => ({
                    stepName: sp.stepName,
                    sessionsCount: sp._count.id,
                    totalQuantity: sp._sum.quantity || 0
                }))
            }
        });
    } catch (error) {
        console.error('[API/Reports/Daily] Error:', error);
        return apiError('Failed to generate report', 500);
    }
}
