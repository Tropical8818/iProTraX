
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

const secretKey = process.env.SESSION_SECRET;
const key = new TextEncoder().encode(secretKey || 'default-secret-key-do-not-use-in-production');

function assertSecureSession() {
    if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
        throw new Error('CRITICAL SECURITY ERROR: SESSION_SECRET is missing in production environment variables.');
    }
}

export async function encrypt(payload: JWTPayload) {
    assertSecureSession();
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h') // Session expires in 24 hours
        .sign(key);
}

export async function decrypt(input: string): Promise<JWTPayload> {
    assertSecureSession();
    const { payload } = await jwtVerify(input, key, {
        algorithms: ['HS256'],
    });
    return payload;
}
