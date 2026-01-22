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

declare const __non_webpack_require__: any;

// Cache the loaded module
let wasmModule: any = null;

// Must be async now because dynamic import is async
export async function verifyLicenseWithWasm(token: string): Promise<VerificationResult> {
    if (!wasmModule) {
        try {
            // In Next.js App Router (Server Components), 'require' is stubbed by Webpack/Turbopack.
            // standard 'require' fails with "dynamic usage of require is not supported".
            // We use 'createRequire' from 'node:module' to create a genuine Node.js require function that bypasses the bundler.

            // We verify 'node:module' import string to bypass Turbopack static analysis which tries to resolve the path at build time.
            const nodeModule = 'node:module';
            const { createRequire } = await import(nodeModule);
            const requireNative = createRequire(import.meta.url);

            // Break path into segments to prevent static analysis trying to resolve '/ROOT/...'
            const native = 'native';
            const pkg = 'license-verifier/pkg/license_verifier.js';
            const pkgPath = path.join(process.cwd(), native, pkg);

            wasmModule = requireNative(pkgPath);
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
