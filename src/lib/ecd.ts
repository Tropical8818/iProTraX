import { Order } from '@/lib/excel';
import { getNow, formatToShortTimestamp, parseFlexibleDate } from '@/lib/date-utils';
import { format } from 'date-fns';

export interface ECDCalculationParams {
    /** The order object containing step status values */
    order: Order;
    /** Ordered list of step names to process */
    steps: string[];
    /** Map of step names to their standard duration in hours */
    durations?: Record<string, number>;
    /** Whether to count Saturdays as working days */
    includeSaturday?: boolean;
    /** Whether to count Sundays as working days */
    includeSunday?: boolean;
}

/**
 * ECD (Estimated Completion Date) Calculation Algorithm
 * 
 * This function predicts when a production order will be completed based on its current status,
 * standard step durations, and work schedule configuration.
 * 
 * ## Core Logic
 * 1. **Identify Start Point**:
 *    - If status is 'QN' (Quality Notification) anywhere, process is disrupted. **Start = NOW**.
 *    - If status is 'Not Started' (no steps completed), **Start = NOW**.
 *    - If process is in flow, **Start = Last Completed Step's Date**.
 *      - *Exception*: If the last step was completed > 24 hours ago (stalled), reset **Start = NOW**.
 * 
 * 2. **Calculate Remaining Work**:
 *    - Sum standard durations for all *incomplete* steps.
 *    - **Status Modifiers**:
 *      - 'WIP' (Work In Progress): Assumed 50% done. Adds `0.5 * duration`.
 *      - 'P' (Pending/Paused) or 'N/A': Standard behavior (depends on specific business rule, currently 'P' adds full duration, 'N/A' is skipped).
 *      - Empty/Blank: Adds full `1.0 * duration`.
 * 
 * 3. **Project Timeline**:
 *    - Add the remaining hours to the Start Time.
 *    - **Skip Non-Working Days**: Automatically pushes dates forward if they land on weekends (unless `includeSaturday`/`includeSunday` is true).
 * 
 * ## Data for Future AI Analysis
 * To optimize step durations, the AI should compare:
 * - `Configured Duration`: The standard time defined in settings.
 * - `Actual Duration`: `Timestamp(Step N) - Timestamp(Step N-1)`.
 * - `ECD Accuracy`: `Actual Completion Date - Predicted ECD`.
 */

export const calculateECD = ({
    order,
    steps,
    durations,
    includeSaturday = false,
    includeSunday = false
}: ECDCalculationParams): string => {
    // If durations are missing, assume default 24h (1 day) per step logic
    const activeDurations = durations && Object.keys(durations).length > 0 ? durations : {};
    if (Object.keys(activeDurations).length === 0) {
        steps.forEach(s => { activeDurations[s] = 24; });
    }

    // Helper: Checks if a value is a valid completion date
    // Uses parseFlexibleDate to robustly handle DD-MM-YYYY, DD-MMM, ISO formats
    const isDate = (val: string) => {
        if (!val || val.length < 5) return false;
        const v = val.toUpperCase().trim();
        if (['N/A', 'WIP', 'PENDING', 'QN', 'DIFA', 'HOLD'].some(s => v.startsWith(s))) return false;
        if (v === 'P' || v.startsWith('P,')) return false;

        // Use the robust parseFlexibleDate utility
        const d = parseFlexibleDate(val);
        if (d && !isNaN(d.getTime()) && d.getFullYear() > 2000) return true;

        // Fallback: try native Date for standard formats
        const d2 = new Date(val);
        return !isNaN(d2.getTime()) && d2.getFullYear() > 2000;
    };

    // Helper: Parse a date value robustly
    const parseDate = (val: string): Date | null => {
        const d = parseFlexibleDate(val);
        if (d && !isNaN(d.getTime()) && d.getFullYear() > 2000) return d;
        const d2 = new Date(val);
        if (!isNaN(d2.getTime()) && d2.getFullYear() > 2000) return d2;
        return null;
    };

    // Check if ALL steps are completed (each has a valid date or N/A)
    // This is the correct way to determine if an order is fully done
    const allStepsCompleted = steps.every(step => {
        const val = (order[step] || '').trim();
        if (!val) return false;
        const v = val.toUpperCase();
        // N/A steps are considered "done" (skipped)
        if (v === 'N/A') return true;
        return isDate(val);
    });

    if (allStepsCompleted) return ''; // Truly completed orders have no ECD

    // Helper: Check for "QN" exception anywhere in the order
    const hasException = steps.some(step => {
        const val = (order[step] || '').toUpperCase();
        return val.includes('QN'); // Only QN triggers reset
    });

    // Normalization helper for fuzzy matching durations
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Create a normalized duration map for robust lookup
    const normalizedDurations: Record<string, number> = {};
    Object.entries(activeDurations).forEach(([k, v]) => {
        normalizedDurations[normalize(k)] = v;
    });

    // 1. Calculate Remaining Hours
    let remainingHours = 0;
    let foundIncomplete = false;
    let lastCompletedDate: Date | null = null;

    for (const step of steps) {
        const val = order[step] || '';
        const v = val.toUpperCase().trim();
        const isNA = v === 'N/A';
        const dur = normalizedDurations[normalize(step)] || 0;

        if (!foundIncomplete) {
            if (isDate(val)) {
                // Keep track of the latest completion time
                const parsed = parseDate(val);
                if (parsed) lastCompletedDate = parsed;
            } else if (!isNA) {
                // Found first incomplete step
                foundIncomplete = true;

                // Add remaining time for this current step
                if (v.startsWith('WIP')) {
                    remainingHours += dur * 0.5; // WIP assumes 50% remaining
                } else if (v.startsWith('P')) {
                    remainingHours += dur;       // Pending assumes full duration
                } else {
                    remainingHours += dur;       // Not started assumes full duration
                }
            }
        } else {
            // Future steps
            if (!isNA) {
                // If this future step already has a date (completed out of order), skip it
                if (isDate(val)) continue;
                remainingHours += dur;
            }
        }
    }

    // 2. Determine Start Time
    let startTime = getNow(); // Use centralized NOW

    if (hasException) {
        // Condition: Exception -> Start from NOW
        startTime = getNow();
    } else if (lastCompletedDate) {
        const now = getNow();
        const diffHours = (now.getTime() - lastCompletedDate.getTime()) / (1000 * 60 * 60);

        if (diffHours > 24) {
            // Condition: Stalled (>24h since last move) -> Start from NOW
            startTime = getNow();
        } else {
            // Condition: Normal Flow -> Start from Last Completion
            startTime = lastCompletedDate;
        }
    } else {
        // Condition: Not started -> Start from NOW
    }

    // If remaining hours is 0 but order is NOT complete, use a minimum of 24h per incomplete step
    // This prevents ECD from disappearing when durations aren't configured or are 0
    if (remainingHours <= 0) {
        // Count how many steps are truly incomplete (not date, not N/A)
        const incompleteSteps = steps.filter(step => {
            const val = (order[step] || '').trim();
            if (!val) return true; // empty = incomplete
            const v = val.toUpperCase();
            if (v === 'N/A') return false;
            return !isDate(val);
        });
        if (incompleteSteps.length === 0) return ''; // Actually all complete
        // Assign a minimum of 24h per incomplete step
        remainingHours = incompleteSteps.length * 24;
    }

    // 3. Project Timeline (Skipping Weekends)
    const targetDate = new Date(startTime);
    let hoursLeft = remainingHours;
    let opsCount = 0;

    while (hoursLeft > 0 && opsCount < 365 * 24) { // Safety break
        opsCount++;

        const dayOfWeek = targetDate.getDay(); // 0=Sun, 6=Sat
        const isSunday = dayOfWeek === 0;
        const isSaturday = dayOfWeek === 6;
        const skipSunday = isSunday && !includeSunday;
        const skipSaturday = isSaturday && !includeSaturday;

        if (skipSunday || skipSaturday) {
            targetDate.setDate(targetDate.getDate() + 1);
            targetDate.setHours(9, 0, 0, 0); // Reset to start of working day (approx 9am)
            continue;
        }

        // It is a working day.
        const currentHour = targetDate.getHours();
        const hoursInDayRemaining = 24 - currentHour;

        if (hoursLeft <= hoursInDayRemaining) {
            targetDate.setHours(targetDate.getHours() + hoursLeft);
            hoursLeft = 0;
        } else {
            // Advance to next day
            targetDate.setDate(targetDate.getDate() + 1);
            targetDate.setHours(0, 0, 0, 0); // Start of next day
            hoursLeft -= hoursInDayRemaining;
        }
    }

    // Format: dd-MMM (e.g. 26-Dec)
    return format(targetDate, 'dd-MMM');
};
