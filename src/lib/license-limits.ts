import { verifyLicense, LicenseDetails } from './license';

export interface LicenseLimits {
    maxProductLines: number;
    maxUsers: number; // New limit
    isValid: boolean;
    licenseType: LicenseDetails['type'];
    customerName: string;
    expiresAt: string;
    warning?: string;
}

/**
 * Get effective license limits for the current deployment.
 * - Valid License: Uses limits from license key.
 * - Invalid/Missing/Expired: Defaults to FREE TIER (1 product line, 10 users).
 */
export async function getLicenseLimits(): Promise<LicenseLimits> {
    const licenseKey = process.env.LICENSE_KEY;
    const license = await verifyLicense(licenseKey);

    if (license.isValid) {
        // Valid license - use configured limits
        return {
            maxProductLines: license.maxProductLines,
            maxUsers: license.maxUsers || 9999,
            isValid: true,
            licenseType: license.type,
            customerName: license.customerName,
            expiresAt: license.expiresAt,
        };
    }

    // Invalid/expired/missing license - downgrade to FREE TIER
    let warning: string;

    if (license.error === 'No license key provided.' || license.error === 'License has expired.') {
        // Treat checking expiry or missing key as fallback to Free Tier
        // We removed the 30-day limit concept for "Trial", it's just a limited Free Tier now.
        warning = 'Free Tier: Limited to 1 product line and 10 users.';
        if (license.error === 'License has expired.') {
            warning = `License expired. Downgraded to Free Tier (1 product line, 10 users).`;
        }
    } else {
        warning = 'Invalid license. Operating in Free Tier (1 product line, 10 users).';
    }

    return {
        maxProductLines: 1, // Free Tier limit
        maxUsers: 10,       // Free Tier limit
        isValid: false,
        licenseType: 'COMMUNITY',
        customerName: license.customerName,
        expiresAt: license.expiresAt,
        warning,
    };
}
