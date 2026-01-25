
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay, subDays } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const session = await getSession();
    if (!session || (session.role !== 'admin' && session.role !== 'supervisor')) {
        // Strict role check or just auth?
        // User reports might be sensitive? Let's restrict to Admin/Supervisor for now.
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const productId = searchParams.get('productId');
        const startDateStr = searchParams.get('startDate'); // ISO string
        const endDateStr = searchParams.get('endDate'); // ISO string

        // Default to last 7 days if not provided
        const endDate = endDateStr ? endOfDay(new Date(endDateStr)) : endOfDay(new Date());
        const startDate = startDateStr ? startOfDay(new Date(startDateStr)) : startOfDay(subDays(new Date(), 7));

        const whereClause: any = {
            startTime: {
                gte: startDate,
                lte: endDate
            },
            endTime: { not: null } // Only completed sessions count for efficiency? Or active too if we handle it?
            // Efficiency needs completed quantity usually. Active sessions have 0 quantity until stopped.
            // So filtering `endTime: { not: null }` is safer.
        };

        if (productId) {
            whereClause.order = { productId };
        }

        // @ts-ignore
        const progressRecords = await prisma.stepProgress.findMany({
            where: whereClause,
            include: {
                user: { select: { username: true } },
                order: {
                    include: { product: true }
                }
            }
        });

        // Aggregation
        const workerStats: Record<string, {
            userId: string;
            username: string;
            totalQuantity: number;
            activeTimeMs: number;
            standardTimeMs: number;
            sessions: number;
        }> = {};

        for (const record of progressRecords) {
            const userId = record.userId;
            if (!workerStats[userId]) {
                workerStats[userId] = {
                    userId,
                    username: record.user.username,
                    totalQuantity: 0,
                    activeTimeMs: 0,
                    standardTimeMs: 0,
                    sessions: 0
                };
            }

            const stats = workerStats[userId];
            const qty = record.quantity || 0;
            const duration = (record.endTime!.getTime() - record.startTime.getTime()); // ms
            // Standard time
            // Standard time
            let stdTime = 0;
            // @ts-ignore
            if (record.standardTime) {
                // @ts-ignore
                stdTime = record.standardTime * 60 * 1000;
            } else {
                try {
                    const productConfig = JSON.parse(record.order.product.config);
                    const stepDuration = productConfig.stepDurations?.[record.stepName]; // minutes usually?
                    if (stepDuration) {
                        stdTime = qty * stepDuration * 60 * 1000; // ms
                    }
                } catch (e) {
                    // Ignore config parse error
                }
            }

            stats.totalQuantity += qty;
            stats.activeTimeMs += duration;
            stats.standardTimeMs += stdTime;
            stats.sessions += 1;
        }

        // Calculate efficiency and format
        const result = Object.values(workerStats).map((stat: any) => {
            const activeTimeHours = stat.activeTimeMs / (1000 * 60 * 60);
            const efficiency = stat.standardTimeMs > 0 && stat.activeTimeMs > 0
                ? (stat.standardTimeMs / stat.activeTimeMs) * 100
                : 0;

            return {
                userId: stat.userId,
                username: stat.username,
                totalQuantity: stat.totalQuantity,
                activeTimeHours: parseFloat(activeTimeHours.toFixed(2)),
                efficiency: parseFloat(efficiency.toFixed(1)),
                sessions: stat.sessions
            };
        });

        // Sort by output
        result.sort((a, b) => b.totalQuantity - a.totalQuantity);

        return NextResponse.json(result);

    } catch (error) {
        console.error('Worker report error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
