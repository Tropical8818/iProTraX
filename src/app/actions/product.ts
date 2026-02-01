'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { SchedulingConfig } from '@/lib/types/config';

export async function updateProductSchedulingConfig(productId: string, schedulingConfig: Partial<SchedulingConfig>) {
    try {
        const product = await prisma.product.findUnique({
            where: { id: productId }
        });

        if (!product) {
            throw new Error('Product not found');
        }

        const currentConfig = product.config ? JSON.parse(product.config) : {};

        // Merge scheduling config
        const newConfig = {
            ...currentConfig,
            schedulingConfig: {
                ...currentConfig.schedulingConfig,
                ...schedulingConfig
            }
        };

        await prisma.product.update({
            where: { id: productId },
            data: {
                config: JSON.stringify(newConfig)
            }
        });

        revalidatePath('/dashboard');
        revalidatePath('/dashboard/settings');
        return { success: true };
    } catch (error) {
        console.error('Failed to update product scheduling config:', error);
        return { success: false, error: 'Failed to update configuration' };
    }
}
