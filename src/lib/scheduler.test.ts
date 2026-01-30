import { recommendSchedule } from './scheduler';
import { Product } from './types/config';

const mockProduct: Product = {
    id: 'test-line',
    name: 'Test Production Line',
    excelPath: '',
    detailColumns: ['WO ID', 'Priority', 'WO DUE'],
    steps: ['Step1', 'Step2'],
    stepDurations: { 'Step1': 1, 'Step2': 2 }, // Hours
    stepStaffCounts: { 'Step1': 2, 'Step2': 1 },
    stepMachineCounts: { 'Step1': 1, 'Step2': 2 },
    schedulingConfig: {
        priorityWeight: 50,
        dateWeight: 30,
        agingWeight: 20
    },
    shiftConfig: {
        standardHours: 8,
        overtimeHours: 0
    }
};

const mockOrders = [
    { id: '1', woId: 'WO001', 'Priority': 'Urgent', 'WO DUE': '2026-01-30', createdAt: new Date('2026-01-10') }, // High Priority, Due Soon
    { id: '2', woId: 'WO002', 'Priority': 'Normal', 'WO DUE': '2026-02-15', createdAt: new Date('2026-01-01') }, // Aging, Late Due
    { id: '3', woId: 'WO003', 'Priority': 'Normal', 'WO DUE': '2026-01-29', createdAt: new Date('2026-01-20') }, // High Urgency
    { id: '4', woId: 'WO004', 'Priority': 'Urgent', 'WO DUE': '2026-03-01', createdAt: new Date('2026-01-25') }, // High Priority, Late Due
    { id: '5', woId: 'WO005', 'Priority': 'Normal', 'WO DUE': '2026-02-10', createdAt: new Date('2026-01-26'), 'Material_Status': 'Not Ready' } // Material Shortage
];

function test() {
    console.log("Running Scheduler Test...");

    // Capacity at Step1: min(2 staff, 1 machine) * 8 hours = 8 hours (480 mins)
    // Capacity at Step2: min(1 staff, 2 machines) * 8 hours = 8 hours (480 mins)

    const result = recommendSchedule(mockOrders, mockProduct);

    console.log("Summary:", result.summary);
    console.log("Recommendations:");
    result.recommendations.forEach(r => {
        console.log(`- ${r.woId} at ${r.stepName} (Score: ${r.score.toFixed(2)})`);
    });

    console.log("Utilization:");
    Object.entries(result.stepUtilization).forEach(([step, util]) => {
        console.log(`- ${step}: ${util.usedMinutes}/${util.totalMinutes} mins (${util.count} orders)`);
    });

    // Validations:
    // 1. WO005 should be skipped (Material)
    // 2. High priority (WO001, WO004) should have good scores
    // 3. WO001 (Priority + Urgency) should be top
}

test();
