import { Product } from './types/config';

// ============ CONSTANTS ============

/**
 * Maximum number of orders to recommend in a single scheduling run
 * Prevents performance issues with large datasets
 */
export const MAX_RECOMMENDATIONS = 500;

// ============ TYPES ============

/**
 * Constraint level for step capacity calculation
 */
export enum ConstraintLevel {
    UNCONSTRAINED = 'unconstrained',       // No constraints - schedule freely
    MACHINE_ANCHORED = 'machine_anchored', // Machine capacity is the anchor
    STAFF_LIMITED = 'staff_limited',       // Staff capacity is the limit
    TIME_BOUND = 'time_bound',             // Only time-based constraint
    FULLY_CONSTRAINED = 'fully_constrained' // All constraints apply
}

export interface OrderScoreDetails {
    orderId: string;
    woId: string;
    combinedScore: number;
    priorityScore: number;
    urgencyScore: number;
    agingScore: number;
    nextStep: string;
    isMaterialReady: boolean;
    materialStatus: string;
    flowScore: number; // NEW: Continuity score
    reason?: string;
    durationMinutes: number;
}

export interface ScheduledStepRecommendation {
    orderId: string;
    woId: string;
    stepName: string;
    score: number;
    predictedFlow: {  // All steps predicted within planning horizon
        stepName: string;
        estimatedStartHour: number;
        estimatedEndHour: number;
    }[];
}

export interface SchedulingResult {
    recommendations: ScheduledStepRecommendation[];
    stepUtilization: Record<string, {
        usedMinutes: number;
        totalMinutes: number;
        count: number;
        constraintLevel?: ConstraintLevel;  // NEW: constraint type for this step
        isUnlimited?: boolean;              // NEW: whether step is unconstrained
    }>;
    summary: {
        totalPlanned: number;
        highPriorityPlanned: number;
        skippedDueToCapacity: number;
        skippedDueToMaterial: number;
        skippedDueToTarget?: number;          // NEW: count of orders exceeding monthly target
        unconstrainedStepsPlanned?: number;  // NEW: count of unconstrained step orders
        dailyCapacityFromGoal?: number;      // NEW: daily capacity based on monthly goal
    };
    aiAnalysis?: string;
}

// ============ HELPER FUNCTIONS ============

/**
 * Calculate daily capacity based on Monthly Goal and working days
 * @param monthlyTarget - Monthly production target
 * @param includeSaturday - Whether to include Saturday as a working day
 * @param includeSunday - Whether to include Sunday as a working day
 * @returns Daily capacity (orders per day)
 */
export function calculateDailyCapacityFromMonthlyGoal(
    monthlyTarget: number | undefined,
    includeSaturday: boolean = false,
    includeSunday: boolean = false
): number | undefined {
    if (!monthlyTarget || monthlyTarget <= 0) return undefined;

    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();

    // Calculate working days in current month
    let workingDays = 0;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dayOfWeek = date.getDay();

        if (dayOfWeek === 0 && !includeSunday) continue;  // Sunday
        if (dayOfWeek === 6 && !includeSaturday) continue; // Saturday

        workingDays++;
    }

    if (workingDays === 0) return undefined;
    return Math.ceil(monthlyTarget / workingDays);
}

/**
 * Normalizes priority into 1-3 scale
 */
function parsePriority(priority: string | number | undefined): number {
    if (priority === undefined) return 1;
    const p = String(priority).toLowerCase().trim();
    if (p === '3' || p.includes('urgent') || p.includes('high') || p.includes('紧急') || p.includes('高')) return 3;
    if (p === '2' || p.includes('normal') || p.includes('medium') || p.includes('普通') || p.includes('中')) return 2;
    return 1;
}

/**
 * Calculates days between two dates
 */
function getDaysDiff(d1: Date, d2: Date): number {
    const diffTime = d2.getTime() - d1.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}



/**
 * Checks if a step is "locked" (has data, timestamp, or specific status)
 */
function isStepLocked(status: string | undefined): boolean {
    if (!status) return false;
    const s = String(status).trim().toUpperCase();
    if (s === '' || s === 'RESET' || s === 'P') return false;

    // Explicit statuses that are locked
    if (['DONE', 'N/A', 'WIP', 'HOLD', 'QN'].includes(s)) return true;

    // Check for timestamp format: dd-MMM, HH:mm (e.g. 02-Jan, 19:30)
    // or YYYY-MM-DD HH:mm (Excel format)
    if (s.match(/\d{1,2}-[A-Za-z]{3},\s*\d{1,2}:\d{2}/)) return true;
    if (s.match(/\d{4}-\d{2}-\d{2}\s*\d{2}:\d{2}/)) return true;

    // Any other data is also considered a lock to prevent overwriting memos
    return true;
}

/**
 * Checks if an order is blocked (has QN or HOLD in any step)
 */
function isOrderBlocked(order: any, steps: string[]): boolean {
    for (const step of steps) {
        const s = String(order[step] || '').trim().toUpperCase();
        if (s === 'HOLD' || s === 'QN') return true;
    }
    return false;
}

/**
 * Core Scoring Logic
 */
export function calculateOrderScore(
    order: any,
    product: Product,
    now: Date = new Date()
): OrderScoreDetails {
    const config = product.schedulingConfig || {
        priorityWeight: 50,
        dateWeight: 30,
        agingWeight: 20,
        flowWeight: 500 // HUGE bonus for WIP continuity (hidden config for now)
    };
    const steps = product.steps || [];

    // 1. Next Step Identification (Strict)
    let nextStep = '';
    for (const step of steps) {
        const status = order[step];
        if (!isStepLocked(status)) {
            nextStep = step;
            break;
        }
    }

    // 2. Resource/Status Block Check
    const materialValue = String(order['Material_Status'] || order['Material Status'] || order['物料状态'] || '').trim();
    const isMaterialReady = materialValue === '齐套' || materialValue === 'Ready' || materialValue === 'OK' || materialValue === '';

    const isBlocked = isOrderBlocked(order, steps);

    // 3. Scores (Normalized 0-100)
    const priority = parsePriority(order['Priority'] || order['优先级']);
    const priorityScore = (priority / 3) * 100;

    const dueDateStr = order['WO DUE'] || order['WO_DUE'] || order['到期日期'];
    let urgencyScore = 0;
    if (dueDateStr) {
        const dueDate = new Date(dueDateStr);
        if (!isNaN(dueDate.getTime())) {
            const daysLeft = getDaysDiff(now, dueDate);
            // OPTIMIZATION: Overdue items grow beyond 100 linearly (+1 per day)
            // This prevents "score flattening" for overdue items.
            if (daysLeft <= 0) {
                urgencyScore = 100 + Math.abs(daysLeft);
            } else {
                urgencyScore = Math.max(0, 100 - (daysLeft * 10));
            }
        }
    }

    const createdAt = order.createdAt ? new Date(order.createdAt) : now;
    const daysSinceStart = getDaysDiff(createdAt, now);
    const agingScore = Math.min(100, daysSinceStart * 5);

    // 4. Continuity / Flow Score (Crucial for "Wait Time Minimization")
    // If order has nextStep > 0, it means it started.
    // We give a massive bonus to ensure it finishes before new starts.
    let flowScore = 0;
    const stepIndex = steps.indexOf(nextStep);
    if (stepIndex > 0) {
        // Progress percentage (0 to 1)
        const progress = stepIndex / (steps.length || 1);
        flowScore = (config.flowWeight || 500) * (0.5 + progress); // Base 250 + Scaled by progress
    }

    // 5. Combined Score Calculation
    // NEW LOGIC: Due Date is primary, Priority modifies weight
    // - Priority 3 (Red):    +1000 bonus (always prioritized regardless of date)
    // - Priority 2 (Yellow): Urgency score doubled (equal weight to date)
    // - Priority 1 (Normal): Date-only (priority has minimal effect)

    let priorityBonus = 0;
    let effectiveUrgencyMultiplier = 1;

    if (priority === 3) {
        // Red: Massive fixed bonus - will always be scheduled first
        priorityBonus = 1000;
    } else if (priority === 2) {
        // Yellow: Double the urgency effect (equal weight to date)
        effectiveUrgencyMultiplier = 2;
    }
    // Priority 1: No bonus, date-driven

    const combinedScore = (
        priorityBonus +
        (urgencyScore * effectiveUrgencyMultiplier * (config.dateWeight / 100)) +
        (agingScore * (config.agingWeight / 100)) +
        flowScore
    );

    const durationMinutes = (product.stepDurations?.[nextStep] || 0) * 60;

    return {
        orderId: order.id,
        woId: order.woId,
        combinedScore,
        priorityScore,
        urgencyScore,
        agingScore,
        nextStep,
        isMaterialReady: isMaterialReady && !isBlocked, // QN/HOLD treats material as not ready/blocked
        materialStatus: isBlocked ? 'QN/HOLD' : materialValue,
        flowScore,
        durationMinutes
    };
}

/**
 * Scheduling Algorithm with Time-Flow Prediction
 * Predicts which steps an order will reach within the planning horizon
 */
export function recommendSchedule(
    orders: any[],
    product: Product,
    manualShiftHours?: number,
    manualOvertimeHours?: number,
    planningHours: number = 8,  // Planning horizon (1-72 hours)
    capacityOverrides?: Record<string, { capacityMinutes: number; reason: string }> // NEW: AI Overrides
): SchedulingResult {
    const now = new Date();
    const steps = product.steps || [];
    const planningMinutes = planningHours * 60;

    // 1. Calculate daily capacity from Monthly Goal
    const dailyCapacityFromGoal = calculateDailyCapacityFromMonthlyGoal(
        product.monthlyTarget,
        product.includeSaturday ?? false,
        product.includeSunday ?? false
    );

    // 2. Define capacity per step
    const shiftConfig = product.shiftConfig || { standardHours: 8, overtimeHours: 0 };
    const standardHours = manualShiftHours ?? shiftConfig.standardHours;
    const overtimeHours = manualOvertimeHours ?? shiftConfig.overtimeHours;
    const totalShiftHours = standardHours + overtimeHours;

    const planningDays = Math.ceil(planningHours / totalShiftHours);

    // 3. Track constraint level and capacity for each step
    const stepConstraintLevels: Record<string, ConstraintLevel> = {};
    const stepCapacityMinutes: Record<string, number> = {};

    steps.forEach(step => {
        // PRIORITY 1: Check for AI Overrides
        if (capacityOverrides && capacityOverrides[step]) {
            stepCapacityMinutes[step] = capacityOverrides[step].capacityMinutes;
            stepConstraintLevels[step] = 'ai_override' as ConstraintLevel;
            return;
        }

        const duration = product.stepDurations?.[step];
        const staff = product.stepStaffCounts?.[step];
        const machines = product.stepMachineCounts?.[step];

        // CORE OPTIMIZATION: If no duration set, step is UNCONSTRAINED
        if (!duration || duration === 0) {
            stepCapacityMinutes[step] = Infinity;
            stepConstraintLevels[step] = ConstraintLevel.UNCONSTRAINED;
            return;
        }

        // Calculate resource-based capacity (Use min if both exist implies staff operates machine)
        // USER FORMULA V2:
        // 1. If Machine is set: Capacity = Machine * PlanningTime / StepTime
        //    (Assumes machines run 24/7 or matching planning horizon)
        // 2. If No Machine: Capacity = Staff * (Standard + Overtime) / StepTime
        //    (Constrained by shift hours)

        let effectiveResourceCount = 0;
        let effectiveHours = 0;

        const hasMachine = machines !== undefined && machines !== null && machines !== 0;
        const hasStaff = staff !== undefined && staff !== null && staff !== 0;

        if (hasMachine) {
            // Case 1: Machine Constrained
            // User requirement: "Machine Quantity x Planning Time"
            effectiveResourceCount = machines;
            effectiveHours = planningHours; // Machines available for full planning window
            stepConstraintLevels[step] = ConstraintLevel.MACHINE_ANCHORED;
        } else if (hasStaff) {
            // Case 2: Staff Constrained
            // User requirement: "Staff Quantity x (Standard + Overtime)"
            // BUT checking against Planning Horizon to reflect reality (cannot work 12h in 8h window)
            effectiveResourceCount = staff;

            const dailyShiftHours = standardHours + overtimeHours;

            if (planningHours <= 24) {
                // Single day: cap at shift hours
                effectiveHours = Math.min(planningHours, dailyShiftHours);
            } else {
                // Multi-day: Days * Shift Hours
                // We use simple daily multiplication for >24h
                const days = Math.ceil(planningHours / 24);
                effectiveHours = days * dailyShiftHours;
            }
            stepConstraintLevels[step] = ConstraintLevel.STAFF_LIMITED;
        } else {
            // Case 3: Time Bound Only (Infinite Resources / 1 Unit)
            stepCapacityMinutes[step] = Infinity;
            stepConstraintLevels[step] = ConstraintLevel.TIME_BOUND;
            return;
        }

        // Final Formula: (Resource * Time * 60)
        // Step Duration is handled in usage calculation (usedMinutes += duration * 60)
        // So Capacity here is Total Available Minutes
        stepCapacityMinutes[step] = effectiveResourceCount * effectiveHours * 60;
    });

    // 4. Initialize step utilization
    const stepUtilization: Record<string, {
        usedMinutes: number;
        totalMinutes: number;
        count: number;
        constraintLevel?: ConstraintLevel;
        isUnlimited?: boolean;
    }> = {};

    steps.forEach(step => {
        stepUtilization[step] = {
            usedMinutes: 0,
            totalMinutes: stepCapacityMinutes[step],
            count: 0,
            constraintLevel: stepConstraintLevels[step],
            isUnlimited: stepConstraintLevels[step] === ConstraintLevel.UNCONSTRAINED
        };
    });

    // 5. Predict Individual Order Flow
    const predictStepFlow = (order: any, startStep: string) => {
        const predictedSteps: { stepName: string; estimatedStartHour: number; estimatedEndHour: number }[] = [];
        const currentStepIndex = steps.indexOf(startStep);
        let accumulatedMinutes = 0;

        for (let i = currentStepIndex; i < steps.length; i++) {
            const step = steps[i];
            const status = order[step];
            if (isStepLocked(status) && String(status).toUpperCase() !== 'P') {
                continue;
            }

            const stepDuration = product.stepDurations?.[step];
            const durationMinutes = (!stepDuration || stepDuration === 0) ? 1 : stepDuration * 60;

            if (accumulatedMinutes >= planningMinutes) break;

            const startHour = accumulatedMinutes / 60;
            const endHour = Math.min((accumulatedMinutes + durationMinutes) / 60, planningHours);

            predictedSteps.push({
                stepName: step,
                estimatedStartHour: Math.round(startHour * 10) / 10,
                estimatedEndHour: Math.round(endHour * 10) / 10
            });

            accumulatedMinutes += durationMinutes;
        }
        return predictedSteps;
    };

    // 6. Calculate scores and sort orders (with Tie-breaking)
    const scoredOrders = orders
        .map(order => calculateOrderScore(order, product, now))
        .filter(scored => scored.nextStep)
        .sort((a, b) => {
            if (Math.abs(b.combinedScore - a.combinedScore) > 0.01) {
                return b.combinedScore - a.combinedScore;
            }
            // Tie-break 1: Raw Due Date (Earliest first)
            const orderA = orders.find(o => o.id === a.orderId);
            const orderB = orders.find(o => o.id === b.orderId);
            const dateA = new Date(orderA?.['WO DUE'] || orderA?.['WO_DUE'] || orderA?.['到期日期'] || 0).getTime();
            const dateB = new Date(orderB?.['WO DUE'] || orderB?.['WO_DUE'] || orderB?.['到期日期'] || 0).getTime();

            if (dateA !== dateB) return dateA - dateB;

            // Tie-break 2: WO ID (Deterministic)
            return String(a.woId).localeCompare(String(b.woId));
        });

    // 7. Fill Capacity with Partial Flow Commitment
    const recommendations: ScheduledStepRecommendation[] = [];
    let highPriorityPlanned = 0;
    let skippedDueToCapacity = 0;
    let skippedDueToMaterial = 0;
    let unconstrainedStepsPlanned = 0;

    for (const scored of scoredOrders) {
        if (recommendations.length >= MAX_RECOMMENDATIONS) break;

        if (!scored.isMaterialReady) {
            skippedDueToMaterial++;
            continue;
        }

        const origOrder = orders.find(o => o.id === scored.orderId);
        if (!origOrder) continue;

        const predictedFlow = predictStepFlow(origOrder, scored.nextStep);
        if (predictedFlow.length === 0) continue;

        // PARTIAL FLOW COMMITMENT: Commit all steps until the first bottleneck
        const pathThatFits: typeof predictedFlow = [];
        const tempUsage: Record<string, number> = {};

        for (const pred of predictedFlow) {
            const step = pred.stepName;
            const util = stepUtilization[step];

            if (util.isUnlimited) {
                pathThatFits.push(pred);
                continue;
            }

            const stepDuration = product.stepDurations?.[step];
            const durationMinutes = (!stepDuration || stepDuration === 0) ? 1 : stepDuration * 60;
            const additionalUsage = (tempUsage[step] || 0) + durationMinutes;

            if (util.totalMinutes !== Infinity && (util.usedMinutes + additionalUsage > util.totalMinutes)) {
                break; // Bottleneck reached!
            }

            tempUsage[step] = additionalUsage;
            pathThatFits.push(pred);
        }

        if (pathThatFits.length > 0) {
            for (const pred of pathThatFits) {
                const step = pred.stepName;
                const util = stepUtilization[step];

                if (util.isUnlimited) {
                    util.count++;
                    unconstrainedStepsPlanned++;
                } else {
                    const stepDuration = product.stepDurations?.[step];
                    const durationMinutes = (!stepDuration || stepDuration === 0) ? 1 : stepDuration * 60;
                    util.usedMinutes += durationMinutes;
                    util.count++;
                }
            }

            recommendations.push({
                orderId: scored.orderId,
                woId: scored.woId,
                stepName: scored.nextStep,
                score: scored.combinedScore,
                predictedFlow: pathThatFits
            });

            if (parsePriority(origOrder?.Priority || origOrder?.优先级) === 3) {
                highPriorityPlanned++;
            }
        } else {
            skippedDueToCapacity++;
        }
    }

    return {
        recommendations,
        stepUtilization,
        summary: {
            totalPlanned: recommendations.length,
            highPriorityPlanned,
            skippedDueToCapacity,
            skippedDueToMaterial,
            skippedDueToTarget: dailyCapacityFromGoal ? Math.max(0, recommendations.length - dailyCapacityFromGoal * planningDays) : 0,
            unconstrainedStepsPlanned,
            dailyCapacityFromGoal
        }
    };
}
