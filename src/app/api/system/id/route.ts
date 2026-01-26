import { NextResponse } from 'next/server';
import { getMachineId, getSystemFingerprint } from '@/lib/system-id';
import { getSession } from '@/lib/auth';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET() {
    const session = await getSession();

    if (!session || session.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const machineId = getMachineId();
        const fingerprint = getSystemFingerprint();

        // Return hash of fingerprint for display, not raw details (security)
        const fingerprintHash = crypto.createHash('sha256').update(fingerprint).digest('hex');

        return NextResponse.json({
            machineId,
            fingerprintHash
        });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to retrieve system ID' }, { status: 500 });
    }
}
