import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { parseExcelBuffer } from '@/lib/excel';

export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'Excel file required' }, { status: 400 });
        }

        // Read the Excel file from uploaded file
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Parse with ExcelJS helper
        let sheetName = '';
        let rawData: unknown[][] = [];
        try {
            const parsed = await parseExcelBuffer(buffer);
            sheetName = parsed.sheetName;
            rawData = parsed.rawData;
        } catch (e) {
            return NextResponse.json({ error: `Failed to parse Excel: ${e instanceof Error ? e.message : String(e)}` }, { status: 400 });
        }

        if (rawData.length < 2) {
            return NextResponse.json({ steps: [] });
        }

        // Row 2 (index 1) contains headers - return ALL headers
        const headers = (rawData[1] as (string | null)[]).map(h => h ? String(h).trim() : '');

        // Return all non-empty headers, user will choose which to keep
        const steps = headers.filter(h =>
            h &&
            h.length > 0 &&
            !h.includes('null') &&
            !h.toLowerCase().includes('unnamed')
        );

        return NextResponse.json({ steps, sheetName });
    } catch (error) {
        console.error('Detect steps error:', error);
        const message = error instanceof Error ? error.message : 'Failed to detect steps';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
