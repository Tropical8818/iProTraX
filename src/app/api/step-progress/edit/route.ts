import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: NextRequest) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check role - only supervisor or admin
    // @ts-ignore
    if (session.user?.role !== 'supervisor' && session.user?.role !== 'admin') {
        const user = await prisma.user.findUnique({ where: { id: session.userId } });
        // @ts-ignore
        if (user?.role !== 'supervisor' && user?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden: Supervisors only' }, { status: 403 });
        }
    }

    try {
        const { id, quantity, endTime, startTime } = await request.json();

        if (!id) {
            return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
        }

        // Fetch existing
        // @ts-ignore
        const existing = await prisma.stepProgress.findUnique({
            where: { id }
        });

        if (!existing) {
            return NextResponse.json({ error: 'Record not found' }, { status: 404 });
        }

        const data: any = {};
        if (quantity !== undefined) {
            // Round to 3 decimal places to avoid floating point errors
            data.quantity = Math.round(parseFloat(quantity) * 1000) / 1000;
        }
        if (endTime) data.endTime = new Date(endTime);
        if (startTime) data.startTime = new Date(startTime);

        // Update
        // @ts-ignore
        const updated = await prisma.stepProgress.update({
            where: { id },
            data
        });

        // Log the edit
        await prisma.operationLog.create({
            data: {
                action: 'EditHistory',
                details: JSON.stringify({ original: existing, new: data }),
                userId: session.userId,
                orderId: existing.orderId
            }
        });

        return NextResponse.json(updated);

    } catch (error: any) {
        console.error('Edit error:', error);
        return NextResponse.json({ error: `Internal Server Error: ${error.message}` }, { status: 500 });
    }
}
