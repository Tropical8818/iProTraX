import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');
    const name = searchParams.get('name') || 'file.xlsx';

    if (!filePath) {
        return NextResponse.json({ error: 'Path is required' }, { status: 400 });
    }

    try {
        // SECURITY: Prevent Path Traversal
        // 1. Resolve to absolute path
        const absolutePath = path.resolve(filePath.startsWith('/') ? filePath : path.join(process.cwd(), filePath));

        // 2. Restrict downloads to the data directory only (allowlist approach)
        const dataDir = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), 'data'));

        // 3. Strict Check: File must be within the data directory.
        //    Append path.sep to prevent bypasses like /data-evil matching /data
        if (!absolutePath.startsWith(dataDir + path.sep) && absolutePath !== dataDir) {
            console.error(`[Security Block] Attempted access outside data dir: ${absolutePath}`);
            return NextResponse.json({ error: 'Access denied: Invalid file path' }, { status: 403 });
        }

        if (!fs.existsSync(absolutePath)) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        const fileBuffer = fs.readFileSync(absolutePath);

        // Sanitize filename to prevent Content-Disposition header injection
        const safeFilename = (name || 'file.xlsx').replace(/["\r\n\\]/g, '_');

        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${safeFilename}"`,
            },
        });
    } catch (error) {
        console.error('Download error:', error);
        return NextResponse.json({ error: 'Failed to download file' }, { status: 500 });
    }
}
