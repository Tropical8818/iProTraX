import { getSystemFingerprint } from './system-id';

// Embedded Public Key (ES256) - Matching the one in Rust/Verifier
// Note: The newlines must be explicit \n for Rust PEM parser to work correctly
const PUBLIC_KEY = "-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEX9BNislruXoueGcZGYR0jRof5Nzs\niuiO2hubmiA6JosZUDf1UN4kli5BGBms/pfYoKFA3pT3b5N1sn0+8fE4OQ==\n-----END PUBLIC KEY-----";

export interface LicensePayload {
    customerName: string;
    type: 'COMMUNITY' | 'STARTER' | 'PRO' | 'ENTERPRISE';
    maxProductLines: number;
    maxUsers?: number;
    expiresAt: string;
    machineId?: string;
}

export interface VerificationResult {
    valid: boolean;
    claims?: LicensePayload;
    error?: string;
}

export async function verifyLicenseWithWasm(token: string): Promise<VerificationResult> {
    try {
        // Collect System Fingerprint
        const systemFingerprint = getSystemFingerprint();

        // Dynamic Import of WASM Module (Async)
        // This requires 'asyncWebAssembly: true' in next.config.ts
        // Points to the local copy in src/lib/wasm-pkg
        const wasm = await import('./wasm-pkg/license_verifier.js');

        // Call the WASM function
        // verify_license_wasm(jwt, pub_key, sys_fp, current_timestamp_ms)
        const jsonResult = wasm.verify_license_wasm(
            token,
            PUBLIC_KEY,
            systemFingerprint,
            Date.now() // Pass current timestamp for expiry check
        );

        const parsed = JSON.parse(jsonResult);

        if (!parsed.isValid) {
            return {
                valid: false,
                error: parsed.error || 'Unknown WASM validation error'
            };
        }

        return {
            valid: true,
            claims: parsed.payload // Rust struct field is 'payload'
        };

    } catch (e: any) {
        console.error('[LicenseWASM] Verification Error:', e);
        return {
            valid: false,
            error: `Runtime Error: ${e.message || e}`
        };
    }
}
