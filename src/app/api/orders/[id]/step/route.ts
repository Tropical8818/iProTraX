import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { format } from 'date-fns';
import { formatToExcelTimestamp, formatToShortTimestamp, formatToFullTimestamp } from '@/lib/date-utils';

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id: woId } = await params;
        const { step, status, productId } = await request.json();

        if (!step || !status || !productId) {
            return NextResponse.json({ error: 'Step, status, and product ID are required' }, { status: 400 });
        }

        // Find the order
        let order;
        // Check if woId looks like a UUID
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(woId);

        if (isUuid) {
            order = await prisma.order.findUnique({
                where: { id: woId }
            });
        }

        if (!order) {
            order = await prisma.order.findUnique({
                where: {
                    productId_woId: {
                        productId,
                        woId
                    }
                }
            });
        }

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        const currentData = JSON.parse(order.data);
        const previousValue = currentData[step] || '';
        let newValue = status;


        if (status === 'Reset') {
            newValue = '';
            delete currentData[step];
        } else if (status === 'Done') {
            // "Done" generates a timestamp in format: YYYY-MM-DD HH:mm (Backend stores full date now)
            // Frontend will handle abbreviation
            newValue = formatToFullTimestamp(new Date());
            currentData[step] = newValue;
        } else if (['P', 'WIP', 'N/A', 'Hold', 'QN', 'DIFA'].includes(status)) {
            // Status markers are kept as-is
            currentData[step] = status;
            newValue = status;
        } else {
            // Fallback: anything else is saved as-is (e.g., manual edits)
            currentData[step] = status;
            newValue = status;
        }

        // Get product name for notifications
        const product = await prisma.product.findUnique({ where: { id: productId } });
        const productName = product?.name || 'Unknown';

        // Transaction: Update Order + Create Log
        const [updatedOrder] = await prisma.$transaction([
            prisma.order.update({
                where: { id: order.id },
                data: {
                    data: JSON.stringify(currentData)
                }
            }),
            prisma.operationLog.create({
                data: {
                    action: status,
                    details: JSON.stringify({
                        step,
                        previousValue,
                        newValue
                    }),
                    userId: session.userId,
                    orderId: order.id,
                    snapshot: JSON.stringify({
                        woId,
                        productName
                    })
                }
            })
        ]);

        // Auto-notify supervisors when Hold or QN is set
        if (status === 'Hold' || status === 'QN') {
            try {
                // Get all supervisors and admins
                const supervisors = await prisma.user.findMany({
                    where: {
                        role: { in: ['admin', 'supervisor'] }
                    },
                    select: { id: true }
                });

                const supervisorIds = supervisors.map(s => s.id);

                // Get current user's username
                const currentUser = await prisma.user.findUnique({
                    where: { id: session.userId },
                    select: { username: true }
                });

                // Create notification comment
                const alertMessage = status === 'Hold'
                    ? `🟠 HOLD Alert: WO ${woId} marked as HOLD at step "${step}" by ${currentUser?.username || 'Unknown'}`
                    : `🔴 QN Alert: WO ${woId} marked as QN at step "${step}" by ${currentUser?.username || 'Unknown'}`;

                await prisma.comment.create({
                    data: {
                        content: alertMessage,
                        userId: session.userId,
                        orderId: order.id,
                        stepName: step,
                        mentionedUserIds: JSON.stringify(supervisorIds),
                        structuredData: JSON.stringify({
                            type: status === 'Hold' ? 'hold_alert' : 'qn_alert',
                            woId,
                            step,
                            productName,
                            setBy: currentUser?.username
                        })
                    }
                });

                console.log(`[Notification] ${status} alert sent to ${supervisorIds.length} supervisors for WO ${woId}`);
            } catch (notifyError) {
                // Don't fail the main operation if notification fails
                console.error('Failed to send supervisor notification:', notifyError);
            }
        }


        // Publish real-time update
        try {
            const { redis } = await import('@/lib/redis');
            await redis.publish('system-updates', JSON.stringify({
                type: 'ORDER_UPDATE',
                productId,
                woId,
                action: status
            }));
        } catch (rErr) {
            console.error('Redis publish error:', rErr);
        }

        return NextResponse.json({ success: true, order: { ...updatedOrder, ...currentData } });
    } catch (error) {
        console.error('Update Step Error:', error);
        return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
    }
}

