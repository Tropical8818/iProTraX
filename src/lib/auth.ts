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
import { createHash } from 'node:crypto';

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
        // console.log('[Auth] Header detected:', authHeader.substring(0, 15) + '...')

        // Case A: Real API Key (sk_live_...)
        if (authHeader.startsWith('Bearer sk_live_')) {
            const apiKey = authHeader.substring(7);
            // console.log('[Auth] Validating API Key check...')

            // Basic format check
            if (apiKey.length < 20) return null;

            const keyHash = createHash('sha256').update(apiKey).digest('hex');

            try {
                const keyRecord = await prisma.apiKey.findUnique({
                    where: { keyHash }
                });

                // console.log('[Auth] Key Record found:', !!keyRecord)

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
            if (!bearerToken) return null;

            // console.log(`[Auth] Attempting Bearer Token: ${bearerToken.substring(0, 10)}...`)

            const tryDecrypt = async (t: string) => {
                try {
                    const payload = await decrypt(t);
                    if (payload.expiresAt && (payload.expiresAt as number) < Date.now()) {
                        console.log('[Auth] Token Expired')
                        return null;
                    }
                    return {
                        userId: payload.userId as string,
                        username: payload.username as string,
                        role: payload.role as UserRole,
                        expiresAt: payload.expiresAt as number
                    };
                } catch (e) {
                    return null;
                }
            }

            // 1. Try Direct
            let session = await tryDecrypt(bearerToken);

            // 2. Try Decoding (if user pasted encoded cookie)
            if (!session) {
                try {
                    const decoded = decodeURIComponent(bearerToken);
                    if (decoded !== bearerToken) {
                        // console.log('[Auth] Trying decoded token...')
                        session = await tryDecrypt(decoded);
                    }
                } catch { }
            }

            if (session) return session;
            console.log('[Auth] Bearer Decrypt Failed')
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
