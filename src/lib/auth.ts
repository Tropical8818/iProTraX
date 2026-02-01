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

const API_KEY = process.env.DIGITAL_TWIN_API_KEY || 'iprotrax-twin-access-key';

export async function getSession(): Promise<Session | null> {
    const cookieStore = await cookies();
    let token = cookieStore.get(SESSION_COOKIE)?.value;

    // Fallback: Check Authorization Header (Bearer Token)
    if (!token) {
        const headersList = await headers();
        const authHeader = headersList.get('Authorization');
        if (authHeader?.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        }
    }

    if (!token) return null;

    // Direct API Key Check
    if (token === API_KEY) {
        return {
            userId: 'digital-twin',
            username: 'Digital Twin',
            role: 'admin',
            expiresAt: Date.now() + 24 * 60 * 60 * 1000 // Valid
        };
    }

    try {
        const payload = await decrypt(token);

        // Convert payload back to typed Session
        const session: Session = {
            userId: payload.userId as string,
            username: payload.username as string,
            role: payload.role as UserRole,
            expiresAt: payload.expiresAt as number
        };

        if (session.expiresAt < Date.now()) {
            await destroySession();
            return null;
        }
        return session;
    } catch {
        return null;
    }
}

export async function destroySession(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE);
}

// Helper function to check if a user is Super Admin
export function isSuperAdmin(username: string): boolean {
    return username === 'superadmin';
}
