import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateApiKey } from '@/lib/api-auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/keys
 * List all API keys for the current user (admin only).
 */
export async function GET() {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    try {
        const keys = await prisma.apiKey.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                prefix: true,
                permissions: true,
                createdAt: true,
                lastUsedAt: true,
                expiresAt: true,
                isActive: true,
                createdById: true
            }
        });

        return NextResponse.json({ keys, success: true });
    } catch (error) {
        console.error('[API Keys] List error:', error);
        return NextResponse.json({ error: 'Failed to list keys' }, { status: 500 });
    }
}

/**
 * POST /api/v1/keys
 * Create a new API key.
 * 
 * Body: { name: string, permissions: string[], expiresAt?: string }
 */
export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    try {
        const body = await request.json();

        if (!body.name || typeof body.name !== 'string') {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        const permissions = body.permissions || ['orders:read', 'products:read'];
        const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

        // Generate the key
        const { rawKey, keyHash, prefix } = generateApiKey();

        // Store in database
        const apiKey = await prisma.apiKey.create({
            data: {
                name: body.name,
                keyHash,
                prefix,
                permissions,
                expiresAt,
                createdById: session.userId
            }
        });

        // Return the raw key ONCE (cannot be retrieved again)
        return NextResponse.json({
            success: true,
            key: {
                id: apiKey.id,
                name: apiKey.name,
                rawKey, // Only returned once!
                prefix: apiKey.prefix,
                permissions: apiKey.permissions,
                createdAt: apiKey.createdAt.toISOString(),
                expiresAt: apiKey.expiresAt?.toISOString()
            },
            warning: 'Save this key now. It cannot be retrieved again.'
        });
    } catch (error) {
        console.error('[API Keys] Create error:', error);
        return NextResponse.json({ error: 'Failed to create key' }, { status: 500 });
    }
}

/**
 * DELETE /api/v1/keys
 * Revoke an API key.
 * 
 * Body: { id: string }
 */
export async function DELETE(request: NextRequest) {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    try {
        const body = await request.json();

        if (!body.id) {
            return NextResponse.json({ error: 'Key ID is required' }, { status: 400 });
        }

        await prisma.apiKey.update({
            where: { id: body.id },
            data: { isActive: false }
        });

        return NextResponse.json({ success: true, message: 'API key revoked' });
    } catch (error) {
        console.error('[API Keys] Delete error:', error);
        return NextResponse.json({ error: 'Failed to revoke key' }, { status: 500 });
    }
}
