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

        // 2. Define allowed root (Project Root)
        const projectRoot = path.resolve(process.cwd());

        // 3. Strict Check: File must be within project root
        if (!absolutePath.startsWith(projectRoot)) {
            console.error(`[Security Block] Attempted access outside root: ${absolutePath}`);
            return NextResponse.json({ error: 'Access denied: Invalid file path' }, { status: 403 });
        }

        // 4. Block access to sensitive files explicitly
        const sensitiveFiles = ['.env', '.git', 'package.json', 'tsconfig.json'];
        if (sensitiveFiles.some(f => absolutePath.includes(f))) {
            return NextResponse.json({ error: 'Access denied: Sensitive file' }, { status: 403 });
        }

        if (!fs.existsSync(absolutePath)) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        const fileBuffer = fs.readFileSync(absolutePath);

        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${name}"`,
            },
        });
    } catch (error) {
        console.error('Download error:', error);
        return NextResponse.json({ error: 'Failed to download file' }, { status: 500 });
    }
}
