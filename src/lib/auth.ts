import { cookies, headers } from 'next/headers';
import { encrypt, decrypt } from './session';

const SESSION_COOKIE = 'iprotrax_sess';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const KIOSK_SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days

export type UserRole = 'user' | 'supervisor' | 'admin' | 'kiosk';

export interface Session {
    userId: string;
    username: string;
    role: UserRole;
    expiresAt: number;
}

export async function createSession(userId: string, username: string, role: string): Promise<void> {
    const duration = role === 'kiosk' ? KIOSK_SESSION_DURATION : SESSION_DURATION;
    const expiresAt = Date.now() + duration;

    const session: Session = {
        userId,
        username,
        role: role as UserRole,
        expiresAt
    };

    const encryptedSession = await encrypt(session as unknown as import('jose').JWTPayload);
    const cookieStore = await cookies();

    cookieStore.set(SESSION_COOKIE, encryptedSession, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: duration / 1000,
        path: '/'
    });
}

import { prisma } from '@/lib/prisma';
import { createHash, pbkdf2Sync } from 'node:crypto';

// Server-side pepper for deterministic API key hashing
const API_KEY_PEPPER = process.env.API_KEY_PEPPER || 'default_iprotrax_pepper_change_me';

/**
 * Hash API Key using PBKDF2 (Deterministic for lookup)
 */
export function hashApiKey(key: string): string {
    return pbkdf2Sync(key, API_KEY_PEPPER, 10000, 64, 'sha512').toString('hex');
}

// ... (existing imports)

export async function getSession(): Promise<Session | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;

    // 1. Try Session Cookie (Browser User)
    if (token) {
        try {
            const payload = await decrypt(token);
            // ... (validate expiration)
            if (payload.expiresAt && (payload.expiresAt as number) < Date.now()) {
                await destroySession();
                return null;
            }
            return {
                userId: payload.userId as string,
                username: payload.username as string,
                role: payload.role as UserRole,
                expiresAt: payload.expiresAt as number
            };
        } catch {
            return null;
        }
    }

    // 2. Try API Key (Digital Twin / External App)
    const headersList = await headers();
    const authHeader = headersList.get('Authorization');

    if (authHeader) {
        // Case A: Real API Key (sk_live_...)
        if (authHeader.startsWith('Bearer sk_live_')) {
            const apiKey = authHeader.substring(7);
            // Basic format check
            if (apiKey.length < 20) return null;

            // Strategy: Dual Lookup (PBKDF2 -> SHA256)
            // 1. Try Secure PBKDF2 Hash first
            const pbkdf2Hash = hashApiKey(apiKey);
            let keyRecord = await prisma.apiKey.findUnique({
                where: { keyHash: pbkdf2Hash }
            });

            // 2. If not found, try Legacy SHA-256 Hash
            if (!keyRecord) {
                // Use Web Crypto API for legacy hash to distinguish from password hashing context
                const encoder = new TextEncoder();
                const data = encoder.encode(apiKey);
                const hashBuffer = await crypto.subtle.digest('SHA-256', data);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                const sha256Hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

                keyRecord = await prisma.apiKey.findUnique({
                    where: { keyHash: sha256Hash }
                });

                // Auto-Migration: If found via legacy hash, upgrade to PBKDF2
                if (keyRecord) {
                    console.log(`[Auth] Migrating API Key ${keyRecord.id} to PBKDF2...`);
                    // We update the hash in background or await? Await to be safe.
                    // We can capture the promise but not await it to speed up response, 
                    // but for security updates, ensuring consistency is better.
                    // But `findUnique` returned the record, so we have it.
                    // We verify isActive later.

                    // We should trigger update.
                    try {
                        await prisma.apiKey.update({
                            where: { id: keyRecord.id },
                            data: { keyHash: pbkdf2Hash }
                        });
                        console.log(`[Auth] Migration successful for Key ${keyRecord.id}`);
                    } catch (err) {
                        console.error(`[Auth] Migration failed for Key ${keyRecord.id}`, err);
                    }
                }
            }

            try {
                if (keyRecord && keyRecord.isActive) {
                    // Check expiration if set
                    if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
                        return null;
                    }

                    // Update usage stats (fire and forget)
                    prisma.apiKey.update({
                        where: { id: keyRecord.id },
                        data: { lastUsedAt: new Date() }
                    }).catch(() => { });

                    // Return Synthetic Session associated with the creator
                    return {
                        userId: keyRecord.createdById,
                        username: `API Key (${keyRecord.name})`,
                        role: 'admin', // Assume Admin for now, or fetch user role
                        expiresAt: Date.now() + (24 * 60 * 60 * 1000)
                    };
                }
            } catch (e) {
                console.error('API Key Auth Error:', e);
            }
        }
        // Case B: Bearer Session Token (No Cookie proxy needed)
        else if (authHeader.startsWith('Bearer ')) {
            const bearerToken = authHeader.split(' ')[1];
            try {
                const payload = await decrypt(bearerToken);
                if (payload.expiresAt && (payload.expiresAt as number) < Date.now()) {
                    return null;
                }
                return {
                    userId: payload.userId as string,
                    username: payload.username as string,
                    role: payload.role as UserRole,
                    expiresAt: payload.expiresAt as number
                };
            } catch {
                // Invalid bearer token, ignore
            }
        }
    }

    return null;
}

export async function destroySession(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE);
}

// Helper function to check if a user is Super Admin
export function isSuperAdmin(username: string): boolean {
    return username === 'superadmin';
}
