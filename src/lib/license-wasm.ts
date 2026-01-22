import path from 'path';

export interface LicensePayload {
    customerName: string;
    type: 'COMMUNITY' | 'STARTER' | 'PRO' | 'ENTERPRISE';
    maxProductLines: number;
    maxUsers?: number;
    expiresAt: string;
}

export interface VerificationResult {
    valid: boolean;
    claims?: LicensePayload;
    error?: string;
}

// Cache the loaded module
let wasmModule: any = null;

// Must be async now because dynamic import is async
export async function verifyLicenseWithWasm(token: string): Promise<VerificationResult> {
    if (!wasmModule) {
        try {
            // Turbopack performs aggressive static analysis and traces all require/import calls.
            // Even with string obfuscation, it still catches `requireNative(pkgPath)`.
            // The ONLY reliable way to bypass this is to use eval() to make the code completely opaque.
            // This is intentional and necessary for runtime-only module loading.

            const pkgPath = path.join(process.cwd(), 'native', 'license-verifier', 'pkg', 'license_verifier.js');

            // Use eval to construct a require that is invisible to static analysis
             
            const dynamicRequire = eval('require');
            wasmModule = dynamicRequire(pkgPath);
        } catch (e) {
            console.error('[LicenseWASM] Failed to load WASM module:', e);
            console.error('[LicenseWASM] CWD:', process.cwd());

            // Fallback or critical failure? 
            // If the module is missing, we can't secure verification.
            return {
                valid: false,
                error: 'Security module missing. Please ensure native/license-verifier is built.'
            };
        }
    }

    try {
        // call verify_license form Rust
        const result = wasmModule.verify_license(token);
        return result as VerificationResult;
    } catch (e) {
        console.error('[LicenseWASM] Error during verification execution:', e);
        return { valid: false, error: 'Verification runtime error.' };
    }
}
