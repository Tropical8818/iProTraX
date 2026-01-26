import { NextRequest } from 'next/server';
import { validateApiKey, apiError, apiSuccess } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/auth/verify
 * Verify an API key and return its permissions.
 */
export async function POST(request: NextRequest) {
    const auth = await validateApiKey(request);

    if (!auth.valid) {
        return apiError(auth.error || 'Unauthorized', 401);
    }

    return apiSuccess({
        valid: true,
        keyId: auth.keyId,
        permissions: auth.permissions
    });
}
