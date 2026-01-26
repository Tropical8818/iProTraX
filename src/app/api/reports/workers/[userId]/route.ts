
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay, subDays } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> } // params is now a Promise in Next.js 15+
) {
    const session = await getSession();
    if (!session || (session.role !== 'admin' && session.role !== 'supervisor')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const { userId } = await params;
        const { searchParams } = new URL(request.url);
        const productId = searchParams.get('productId');
        const startDateStr = searchParams.get('startDate');
        const endDateStr = searchParams.get('endDate');

        const endDate = endDateStr ? endOfDay(new Date(endDateStr)) : endOfDay(new Date());
        const startDate = startDateStr ? startOfDay(new Date(startDateStr)) : startOfDay(subDays(new Date(), 7));

        const whereClause: any = {
            userId: userId,
            startTime: {
                gte: startDate,
                lte: endDate
            },
            endTime: { not: null }
        };

        if (productId) {
            whereClause.order = { productId };
        }

        // @ts-ignore
        const logs = await prisma.stepProgress.findMany({
            where: whereClause,
            include: {
                order: {
                    select: {
                        data: true, // Assuming data contains WO ID inside JSON
                        id: true // Fallback
                    }
                }
            },
            orderBy: {
                endTime: 'desc'
            }
        });

        // Format for frontend
        const formattedLogs = logs.map((log: any) => {
            let woId = log.order.id;
            try {
                // Try to parse WO ID from order data if available
                if (typeof log.order.data === 'string') {
                    const data = JSON.parse(log.order.data);
                    woId = data['WO ID'] || data.woId || log.order.id;
                } else if (typeof log.order.data === 'object' && log.order.data !== null) {
                    // @ts-ignore
                    woId = log.order.data['WO ID'] || log.order.data.woId || log.order.id;
                }
            } catch (e) {
                // Fallback to ID
            }

            return {
                id: log.id,
                woId: String(woId),
                stepName: log.stepName,
                quantity: log.quantity || 0,
                // @ts-ignore
                startTime: log.startTime.toISOString(),
                // @ts-ignore
                endTime: log.endTime?.toISOString(),
                // @ts-ignore
                durationMinutes: log.endTime ? Math.round((log.endTime.getTime() - log.startTime.getTime()) / 60000) : 0
            };
        });

        return NextResponse.json({ logs: formattedLogs });

    } catch (error) {
        console.error('Worker details error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
