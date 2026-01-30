'use server';

import { Product } from '@/lib/types/config';
import { chat } from '@/lib/ai/client';

export interface AICapacityResult {
    [stepName: string]: {
        capacityMinutes: number; // Total available minutes (Resource * Time)
        reason: string;
    }
}

/**
 * AI Autopilot: Calculate Capacity Strategy
 * Analyzes step configuration (Staff, Machines, Shift) and Planning Horizon
 * to determine the optimal capacity limits, overriding static formulas.
 */
export async function calculateCapacityWithAI(
    product: Product,
    planningHours: number,
    standardHours: number,
    overtimeHours: number,
    ordersCount: number,
    monthlyTarget?: number // NEW: Monthly Goal Reference
): Promise<AICapacityResult> {
    if (!product.aiModel) {
        throw new Error("No AI Model selected in settings.");
    }

    const steps = product.steps || [];
    const shiftTotal = standardHours + overtimeHours;

    console.log("--- AI Autopilot Request ---");
    console.log("Steps:", steps);
    console.log("Staff:", product.stepStaffCounts);
    console.log("Machines:", product.stepMachineCounts);

    // Construct a context-rich prompt
    const prompt = `
You are an expert Production Planner AI (Autopilot).
Your goal is to determine the MAXIMUM CAPACITY (in minutes) for each process step in a manufacturing line, based on resources and time constraints.

### Context
- **Product Line**: ${product.name}
- **Planning Horizon**: ${planningHours} hours (The forecast window we are trying to fill)
- **Shift Constraints**: Standard ${standardHours}h + Overtime ${overtimeHours}h = Total ${shiftTotal}h per person per day.
- **Shift Constraints**: Standard ${standardHours}h + Overtime ${overtimeHours}h = Total ${shiftTotal}h per person per day.
- **Total Pending Orders**: ${ordersCount}
- **Monthly Target**: ${monthlyTarget || 'Not Set'} (Use this to gauge if we need to push harder to meet goals)

### Process Steps Definition & Resources
${steps.map(step => {
        const staff = product.stepStaffCounts?.[step] || 0;
        const machines = product.stepMachineCounts?.[step] || 0;
        const duration = product.stepDurations?.[step] || 0;
        return `- **${step}**: Staff=${staff}, Machines=${machines}, Unit Cycle Time=${duration}h`;
    }).join('\n')}

### Logic Requirements (The "Brain")
1. **Machine Logic**: If a step has Machines (>0), assume they can run for the FULL Planning Horizon (up to 24h/day), unless staff is 0. If staff is involved, check if they limit the machine (usually 1 person can run multiple machines, or machine runs auto).
   - *Default Rule*: Capacity = Machines * PlanningHours * 60 minutes.
2. **Staff Logic**: If a step has NO Machines (Manual), capacity is strictly limited by the Shift Hours.
   - *Default Rule*: Capacity = Staff * MIN(PlanningHours, ShiftTotal) * 60 minutes.
3. **Bottleneck Awareness**: Identify which resource (Man or Machine) is the true constraint for each step.
4. **Reasoning**: Explain *why* you set this limit (e.g., "Limited by 8h shift despite 24h forecast").

### Output Format
Return valid JSON ONLY. No markdown, no explanations outside JSON.
Structure:
{
  "StepName": { "capacityMinutes": 1234, "reason": "2 Machines * 8h planning" },
  ...
}
`;

    try {
        const response = await chat([
            { role: 'system', content: 'You are a precise production simulation engine. Return JSON only.' },
            { role: 'user', content: prompt }
        ], {
            provider: product.aiProvider || 'openai',
            model: product.aiModel,
            temperature: 0.1 // Low temp for math/logic precision
        });

        console.log("--- AI Autopilot Raw Response ---");
        console.log(response);

        // Clean response of potential markdown code blocks
        const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson);

    } catch (error) {
        console.error('AI Autopilot Error:', error);
        throw new Error("AI failed to calculate capacity.");
    }
}
