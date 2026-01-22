import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: NextRequest) {
    const session = await getSession();
    if (!session || (session.role !== 'admin' && session.role !== 'supervisor')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const { orderId, stepName, standardTime } = await request.json();

        if (!orderId || !stepName || standardTime === undefined) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        // Update all records for this order step to have the new standard time
        // This ensures consistency
        // @ts-ignore
        await prisma.stepProgress.updateMany({
            where: {
                orderId,
                stepName
            },
            data: {
                standardTime: parseFloat(standardTime)
            }
        });

        // Also, if no records exist yet (edge case where supervisor sets it before anyone starts),
        // we can't really "store" it on StepProgress without a record. 
        // But usually this feature is "correcting" or "setting" for the active flow.
        // If no records exist, we might need a separate table or just wait for first create.
        // For now, updating existing records is sufficient as per "Edit" requirement.

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Update standard time error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
