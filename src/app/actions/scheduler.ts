'use server';

import { Product } from '@/lib/types/config';
import { chat } from '@/lib/ai/client';
import { calculateOrderScore, SchedulingResult } from '@/lib/scheduler';

/**
 * AI Auxiliary Decision Support (Server Side)
 * Analyzes the results and provides context-aware feedback.
 * This runs on the server to avoid bundling Node.js modules (fs, path) on the client.
 */
export async function refineScheduleWithAI(
    orders: any[],
    product: Product,
    result: SchedulingResult
): Promise<string> {
    if (!product.customInstructions && !product.aiModel) {
        return ""; // Skip if no AI config
    }

    try {
        const topScored = orders
            .map(o => calculateOrderScore(o, product))
            .filter(s => s.nextStep)
            .sort((a, b) => b.combinedScore - a.combinedScore)
            .slice(0, 15);

        const prompt = `You are an expert Production Scheduler assistant.
Specific Product Context: ${product.customInstructions || "Standard production line"}

Current Scheduling Results:
- Total Planned: ${result.summary.totalPlanned}
- High Priority Planned: ${result.summary.highPriorityPlanned}
- Skipped due to Capacity: ${result.summary.skippedDueToCapacity}
- Skipped due to Material/Block: ${result.summary.skippedDueToMaterial}

Top priority orders analyzed by algorithm:
${topScored.map(s => `- WO ${s.woId}: Score ${s.combinedScore.toFixed(1)}, Next Step: ${s.nextStep}, Material: ${s.materialStatus}`).join('\n')}

Based on the results and product context, provide a very concise (max 3 sentences) auxiliary advice. 
Identify if any critical order seems missing or if capacity should be shifted. 
If everything looks optimal, just confirm.`;

        const response = await chat([
            { role: 'system', content: 'You provide brief, professional production scheduling advice.' },
            { role: 'user', content: prompt }
        ], {
            provider: product.aiProvider,
            model: product.aiModel,
            maxTokens: 150
        });

        return response;
    } catch (error) {
        console.error('AI Refinement Error:', error);
        return "AI analysis unavailable at this time.";
    }
}
