import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getConfig, updateConfig } from '@/lib/config';
import { getLicenseLimits } from '@/lib/license-limits';

export const dynamic = 'force-dynamic';

export async function GET() {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Get license limits to enforce product line restrictions
        const licenseLimits = await getLicenseLimits();

        const products = await prisma.product.findMany();

        const formattedProducts = products.map(p => {
            const config = JSON.parse(p.config);
            return {
                id: p.id,
                name: p.name,
                watchFolder: p.watchFolder,
                ...config
            };
        });

        // Apply license limit: only return allowed number of products
        const limitedProducts = formattedProducts.slice(0, licenseLimits.maxProductLines);

        // Find active product - must be within allowed products
        const activeProduct = products.find(p => p.isActive);
        const allowedIds = limitedProducts.map(p => p.id);
        const effectiveActiveId = activeProduct && allowedIds.includes(activeProduct.id)
            ? activeProduct.id
            : limitedProducts[0]?.id;

        // Read global config from file
        const globalConfig = getConfig();

        return NextResponse.json({
            products: limitedProducts,
            activeProductId: effectiveActiveId,
            // License info for UI display
            license: {
                maxProductLines: licenseLimits.maxProductLines,
                totalProducts: products.length,
                isLimited: products.length > licenseLimits.maxProductLines,
                warning: licenseLimits.warning,
            },
            // Return global settings
            aiProvider: globalConfig.aiProvider,
            openAIApiKey: globalConfig.openAIApiKey,
            ollamaUrl: globalConfig.ollamaUrl,
            ollamaModel: globalConfig.ollamaModel,
            deepseekApiKey: globalConfig.deepseekApiKey,
            deepseekModel: globalConfig.deepseekModel,
            includeSaturday: globalConfig.includeSaturday,
            includeSunday: globalConfig.includeSunday,
            systemPrompt: globalConfig.systemPrompt,
            rolePrompts: globalConfig.rolePrompts
        });
    } catch (error) {
        console.error('Config fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admin and supervisor can update config
    if (session.role !== 'admin' && session.role !== 'supervisor') {
        return NextResponse.json({ error: 'Admin or supervisor access required' }, { status: 403 });
    }

    try {
        const body = await request.json();
        console.log('[APIConfig] Received Body:', JSON.stringify(body, null, 2));

        // Check license limits before allowing product changes
        if (body.products) {
            const licenseLimits = await getLicenseLimits();
            if (body.products.length > licenseLimits.maxProductLines) {
                return NextResponse.json({
                    error: `License limit exceeded. Your ${licenseLimits.isValid ? licenseLimits.licenseType : 'COMMUNITY'} license allows ${licenseLimits.maxProductLines} product line(s). Upgrade your license for more.`,
                    licenseWarning: licenseLimits.warning
                }, { status: 403 });
            }
        }

        // 1. Handle Global Config Updates (AI, etc.)
        const globalUpdates: any = {};
        if (body.aiProvider) globalUpdates.aiProvider = body.aiProvider;
        if (body.openAIApiKey !== undefined) globalUpdates.openAIApiKey = body.openAIApiKey;
        if (body.ollamaUrl) globalUpdates.ollamaUrl = body.ollamaUrl;
        if (body.ollamaModel) globalUpdates.ollamaModel = body.ollamaModel;
        if (body.deepseekApiKey !== undefined) globalUpdates.deepseekApiKey = body.deepseekApiKey;
        if (body.deepseekModel) globalUpdates.deepseekModel = body.deepseekModel;
        if (body.includeSaturday !== undefined) globalUpdates.includeSaturday = body.includeSaturday;
        if (body.includeSunday !== undefined) globalUpdates.includeSunday = body.includeSunday;
        if (body.systemPrompt !== undefined) globalUpdates.systemPrompt = body.systemPrompt;
        if (body.rolePrompts !== undefined) globalUpdates.rolePrompts = body.rolePrompts;

        if (Object.keys(globalUpdates).length > 0) {
            updateConfig(globalUpdates);
        }

        if (body.products) {
            const incomingIds = body.products.map((p: any) => p.id);

            // 1. Delete products not in the incoming list (except matching existing ones)
            // Use transaction or separate calls
            await prisma.product.deleteMany({
                where: {
                    id: { notIn: incomingIds }
                }
            });

            // 2. Upsert incoming products
            for (const p of body.products) {
                const { id, name, watchFolder, ...config } = p;

                // Helper to generate slug
                const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                // We add ID suffix to ensure uniqueness especially if multiple products have same name
                const slug = `${baseSlug}-${id.slice(-6)}`;

                if (id) {
                    await prisma.product.upsert({
                        where: { id },
                        update: {
                            name,
                            watchFolder, // Update the column
                            config: JSON.stringify(config)
                        },
                        create: {
                            id,
                            name,
                            slug, // Ensure slug is unique
                            watchFolder, // Set the column
                            config: JSON.stringify(config),
                            isActive: false // Default, active state handled below
                        }
                    });
                }
            }
        }

        // Handle Active Product Switch
        if (body.activeProductId) {
            // Deactivate all
            await prisma.product.updateMany({
                data: { isActive: false }
            });
            // Activate target
            await prisma.product.update({
                where: { id: body.activeProductId },
                data: { isActive: true }
            });
            // Also update global config for redundancy if needed, but Prisma is source of truth for active product
            updateConfig({ activeProductId: body.activeProductId });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Config update error:', error);
        return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
    }
}
