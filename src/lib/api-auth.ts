import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createHash } from 'node:crypto'; // Keeping for legacy fallback
import { hashApiKey } from './auth'; // Import shared secure hash helper

export interface ApiAuthResult {
    valid: boolean;
    keyId?: string;
    permissions?: string[];
    error?: string;
}

/**
 * Validate API Key from Authorization header.
 * Expected format: "Bearer sk_live_xxxxxxxxxxxxxxxx"
 */
export async function validateApiKey(request: NextRequest): Promise<ApiAuthResult> {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader) {
        return { valid: false, error: 'Missing Authorization header' };
    }

    if (!authHeader.startsWith('Bearer ')) {
        return { valid: false, error: 'Invalid Authorization format. Use: Bearer <api_key>' };
    }

    const apiKey = authHeader.substring(7); // Remove "Bearer "

    if (!apiKey || apiKey.length < 20) {
        return { valid: false, error: 'Invalid API key format' };
    }

    // Hash the provided key to compare with stored hash
    // Strategy: 1. Try Secure PBKDF2
    const pbkdf2Hash = hashApiKey(apiKey);
    let keyRecord = await prisma.apiKey.findUnique({
        where: { keyHash: pbkdf2Hash }
    });

    // 2. Fallback to Legacy SHA-256
    if (!keyRecord) {
        // Use Web Crypto API for legacy hash
        // codeql[js/insufficient-password-hash] - Intentional Legacy Support
        const encoder = new TextEncoder();
        const data = encoder.encode(apiKey);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const sha256Hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        keyRecord = await prisma.apiKey.findUnique({
            where: { keyHash: sha256Hash }
        });

        // Auto-Migration
        if (keyRecord) {
            console.log(`[API Auth] Migrating Key ID ${keyRecord.id} to PBKDF2`);
            prisma.apiKey.update({
                where: { id: keyRecord.id },
                data: { keyHash: pbkdf2Hash }
            }).catch((e: any) => console.error('[API Auth] Migration failed:', e));
        }
    }

    try {
        if (!keyRecord) {
            return { valid: false, error: 'Invalid API key' };
        }

        if (!keyRecord.isActive) {
            return { valid: false, error: 'API key has been revoked' };
        }

        if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
            return { valid: false, error: 'API key has expired' };
        }

        // Update last used timestamp (async, don't wait)
        prisma.apiKey.update({
            where: { id: keyRecord.id },
            data: { lastUsedAt: new Date() }
        }).catch(() => { }); // Ignore errors

        return {
            valid: true,
            keyId: keyRecord.id,
            permissions: keyRecord.permissions
        };
    } catch (error) {
        console.error('[API Auth] Error validating key:', error);
        return { valid: false, error: 'Authentication service error' };
    }
}

/**
 * Check if the API key has a specific permission.
 */
export function hasPermission(permissions: string[], required: string): boolean {
    // Support wildcards like "orders:*" or "*"
    if (permissions.includes('*')) return true;
    if (permissions.includes(required)) return true;

    // Check for category wildcard (e.g., "orders:*" matches "orders:read")
    const [category] = required.split(':');
    if (permissions.includes(`${category}:*`)) return true;

    return false;
}

/**
 * Generate a new API key.
 * Returns the raw key (only shown once) and the hash for storage.
 */
export function generateApiKey(): { rawKey: string; keyHash: string; prefix: string } {
    const randomBytes = Buffer.from(
        Array.from({ length: 32 }, () => Math.floor(Math.random() * 256))
    );
    const keyBody = randomBytes.toString('base64url');
    const rawKey = `sk_live_${keyBody}`;

    // Use Secure PBKDF2 for new keys
    const keyHash = hashApiKey(rawKey);
    const prefix = rawKey.substring(0, 12); // "sk_live_xxxx"

    return { rawKey, keyHash, prefix };
}

/**
 * Helper to create JSON error response.
 */
export function apiError(message: string, status: number = 400): NextResponse {
    return NextResponse.json(
        { error: message, success: false },
        { status }
    );
}

/**
 * Helper to create JSON success response.
 */
export function apiSuccess<T>(data: T, status: number = 200): NextResponse {
    return NextResponse.json(
        { ...data, success: true },
        { status }
    );
}
