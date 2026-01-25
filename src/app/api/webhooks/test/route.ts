import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { NotificationService } from '@/lib/services/notification-service';
import { WebhookConfig } from '@/lib/types/config';

export async function POST(request: Request) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const webhook = await request.json() as WebhookConfig;

        if (!webhook.url && !['bark', 'telegram', 'gotify'].includes(webhook.provider)) {
            return NextResponse.json({ error: 'Webhook URL is required' }, { status: 400 });
        }

        console.log(`[API/Test] Testing webhook: ${webhook.name} (${webhook.provider})`);

        // Send a test message
        // We need to bypass the "event subscription" check in the main send() method
        // by calling dispatchWebhook directly? 
        // BUT dispatchWebhook is private.
        // So we should use send() but ensure the webhook is "temporarily" considered active?
        // Actually NotificationService.send reads from config. 
        // If this is a NEW webhook not yet saved, NotificationService won't see it.

        // Solution: We need a public 'test' method on NotificationService 
        // OR we just Instantiate a one-off sender here.
        // But NotificationService logic is complex (signatures etc).

        // Let's Add a public test method to NotificationService? 
        // Or just let's make dispatchWebhook public? 
        // No, let's expose a static helper or instance method "testWebhook(webhook, payload)"

        // For now, let's check NotificationService again.
        // It has `dispatchWebhook` as private.
        // I will update NotificationService to allow direct sending or `testConnection`.

        // Waiting to see NotificationService structure first... 
        // Assuming I can add `sendTest` to it.

        // Let's try to assume I will add `sendTest(webhook)` to NotificationService.

        await NotificationService.getInstance().sendTest(webhook);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Test webhook error:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to send test' }, { status: 500 });
    }
}
