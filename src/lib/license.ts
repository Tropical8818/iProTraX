import { verifyLicenseWithWasm, LicensePayload } from './license-wasm';

// Re-export specific interface compatible with the app
export interface LicenseDetails {
    customerName: string;
    type: 'COMMUNITY' | 'STARTER' | 'PRO' | 'ENTERPRISE';
    maxProductLines: number;
    maxUsers?: number;
    expiresAt: string;
    isValid: boolean;
    error?: string;
}

export async function verifyLicense(licenseKey?: string): Promise<LicenseDetails> {
    const isDev = process.env.NODE_ENV === 'development';

    // If no key provided, return valid Free Tier state
    if (!licenseKey || !licenseKey.trim()) {
        if (isDev) console.log('[License] No key provided. Defaulting to Free Tier.');
        return {
            customerName: 'Community Free',
            type: 'COMMUNITY',
            maxProductLines: 1,
            maxUsers: 10,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000 * 100).toISOString(), // effectively forever
            isValid: true,
            error: undefined
        };
    }

    // Call the WASM module
    // We remove the logging of "Using Custom Public Key" because the key is now embedded/hidden.
    // console.log('[License] Verifying key via Native Module...');

    const result = await verifyLicenseWithWasm(licenseKey);

    if (result.valid && result.claims) {
        console.log('[License] Verification Successful (WASM):', result.claims.customerName);
        return {
            customerName: result.claims.customerName,
            type: result.claims.type,
            maxProductLines: result.claims.maxProductLines,
            maxUsers: result.claims.maxUsers || 100, // Default if struct missing it
            expiresAt: result.claims.expiresAt,
            isValid: true,
            error: undefined
        };
    } else {
        console.error('[License] Verification Failed (WASM):', result.error);
        return {
            customerName: 'Invalid',
            type: 'COMMUNITY',
            maxProductLines: 0,
            maxUsers: 0,
            expiresAt: new Date().toISOString(),
            isValid: false,
            error: result.error || 'Invalid license signature.'
        };
    }
}
