import { NextResponse } from 'next/server';
import { verifyLicense } from '@/lib/license';

export async function GET() {
    // Read license key from env (in production, this should be the deployed key)
    // For now, read from LICENSE_KEY env var or fallback
    const licenseKey = process.env.LICENSE_KEY;

    const details = await verifyLicense(licenseKey);

    return NextResponse.json(details);
}
