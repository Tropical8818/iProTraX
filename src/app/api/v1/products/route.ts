import { NextRequest } from 'next/server';
import { validateApiKey, hasPermission, apiError, apiSuccess } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/products
 * List all product lines with their configurations.
 */
export async function GET(request: NextRequest) {
    const auth = await validateApiKey(request);
    if (!auth.valid) {
        return apiError(auth.error || 'Unauthorized', 401);
    }

    if (!hasPermission(auth.permissions || [], 'products:read')) {
        return apiError('Insufficient permissions', 403);
    }

    try {
        const products = await prisma.product.findMany({
            orderBy: { name: 'asc' }
        });

        const formattedProducts = products.map(p => {
            const config = JSON.parse(p.config || '{}');
            return {
                id: p.id,
                slug: p.slug,
                name: p.name,
                isActive: p.isActive,
                steps: config.steps || [],
                detailColumns: config.detailColumns || [],
                monthlyTarget: config.monthlyTarget,
                createdAt: p.createdAt.toISOString(),
                updatedAt: p.updatedAt.toISOString()
            };
        });

        return apiSuccess({
            products: formattedProducts,
            total: products.length
        });
    } catch (error) {
        console.error('[API/Products] Error:', error);
        return apiError('Failed to fetch products', 500);
    }
}
