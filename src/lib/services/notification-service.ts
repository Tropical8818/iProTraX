import { WebhookConfig, getConfig } from '@/lib/config';
import { createHmac } from 'node:crypto';

type NotificationEvent = 'on_hold' | 'on_qn' | 'on_done' | 'on_step_update' | 'on_message';

interface OrderPayload {
    orderId: string;
    step?: string;
    status?: string;
    productName?: string;
    operator?: string;
    details?: Record<string, any>;
    // For on_message
    message?: string;
    sender?: string;
}

export class NotificationService {
    private static instance: NotificationService;

    private constructor() { }

    public static getInstance(): NotificationService {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }

    /**
     * Send notification to all configured webhooks that subscribe to this event.
     */
    public async send(event: NotificationEvent, payload: OrderPayload) {
        const config = getConfig();
        if (!config.webhooks || config.webhooks.length === 0) return;

        const activeWebhooks = config.webhooks.filter(w => w.enabled && w.events.includes(event));

        if (activeWebhooks.length === 0) return;

        console.log(`[Notification] Sending ${event} to ${activeWebhooks.length} webhooks...`);

        const promises = activeWebhooks.map(webhook => this.dispatchWebhook(webhook, event, payload));
        await Promise.allSettled(promises);
    }

    /**
     * Send a test notification to a specific webhook config (saved or unsaved).
     */
    public async sendTest(webhook: WebhookConfig) {
        const testPayload: OrderPayload = {
            orderId: 'TEST-123456',
            step: 'Test Step',
            status: 'Testing',
            productName: 'Test Product',
            operator: 'Test Operator',
            message: 'This is a test notification from iProTraX.'
        };

        // We use 'on_message' or a generic event for testing
        // Let's use 'on_message' as it's the most generic
        await this.dispatchWebhook(webhook, 'on_message', testPayload);
    }

    // Helper: Generate DingTalk Signature
    private signDingTalk(secret: string): { timestamp: number, sign: string } {
        const timestamp = Date.now();
        const stringToSign = `${timestamp}\n${secret}`;
        const sign = createHmac('sha256', secret)
            .update(stringToSign)
            .digest('base64');
        return { timestamp, sign: encodeURIComponent(sign) };
    }

    // Helper: Generate Feishu Signature
    private signFeishu(secret: string): { timestamp: string, sign: string } {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const stringToSign = `${timestamp}\n${secret}`;
        const sign = createHmac('sha256', stringToSign)
            .update('')
            .digest('base64');
        return { timestamp, sign };
    }

    private async dispatchWebhook(webhook: WebhookConfig, event: NotificationEvent, payload: OrderPayload) {
        try {
            let url = webhook.url;
            let body = this.buildPayload(webhook, event, payload);
            let headers: any = { 'Content-Type': 'application/json' };

            // Dynamic URL Construction & Provider Specifics
            // Dynamic URL Construction & Provider Specifics
            if (webhook.provider === 'bark' && webhook.settings?.deviceKey) {
                const rawServerUrl = webhook.settings.serverUrl?.replace(/\/+$/, '') || 'https://api.day.app';
                const deviceKey = webhook.settings.deviceKey;

                // Intelligent URL Construction:
                // Case 1: Server URL already contains the Device Key (user pasted full URL)
                //         → Use the URL directly as the base, just append Title/Body
                // Case 2: Server URL is just the host (e.g., https://api.day.app)
                //         → Append Key/Title/Body as usual

                let baseUrl: string;
                if (rawServerUrl.includes(deviceKey)) {
                    // User's URL already has the key embedded, use it directly
                    baseUrl = rawServerUrl;
                    console.log(`[Notification/Bark] Server URL contains Key, using directly.`);
                } else {
                    // Standard case: append key
                    baseUrl = `${rawServerUrl}/${deviceKey}`;
                }
                // Ensure no trailing slashes
                baseUrl = baseUrl.replace(/\/+$/, '');

                // Build Title and Body
                const titleStr = webhook.name || body?.title || `iProTraX: ${event}`;
                const bodyStr = body?.body || body?.text || `Order: ${payload.orderId}`;

                const title = encodeURIComponent(titleStr);
                const textBody = encodeURIComponent(bodyStr);

                const sound = webhook.settings.sound || 'minuet';
                const icon = webhook.settings.icon ? `&icon=${encodeURIComponent(webhook.settings.icon)}` : '';
                const group = body?.group ? `&group=${encodeURIComponent(body.group)}` : '&group=iProTraX';

                url = `${baseUrl}/${title}/${textBody}?sound=${sound}${icon}${group}`;

                console.log(`[Notification/Bark] GET: [BASE]/${title}/${textBody}`);

                // Body must be undefined for GET
                body = undefined;

            } else if (webhook.provider === 'dingtalk') {
                // Handle optional Sign Secret
                if (webhook.settings?.signSecret) {
                    const { timestamp, sign } = this.signDingTalk(webhook.settings.signSecret);
                    // Append valid query params
                    const separator = url.includes('?') ? '&' : '?';
                    url = `${url}${separator}timestamp=${timestamp}&sign=${sign}`;
                }

            } else if (webhook.provider === 'feishu') {
                // Handle optional Sign Secret (Inject into Body)
                if (webhook.settings?.signSecret) {
                    const { timestamp, sign } = this.signFeishu(webhook.settings.signSecret);
                    body = {
                        timestamp,
                        sign,
                        ...body // Spread original card/msg_type
                    };
                }

            } else if (webhook.provider === 'telegram' && webhook.settings?.botToken && webhook.settings?.chatId) {
                // ... (Telegram existing logic) ...
                url = `https://api.telegram.org/bot${webhook.settings.botToken}/sendMessage`;
                body = {
                    chat_id: webhook.settings.chatId,
                    ...body
                };
            } else if (webhook.provider === 'gotify' && webhook.settings?.serverUrl && webhook.settings?.appToken) {
                const serverUrl = webhook.settings.serverUrl.replace(/\/$/, '');
                url = `${serverUrl}/message?token=${webhook.settings.appToken}`;
            }

            // ... (rest of logic) ...

            // Custom Headers
            if (webhook.provider === 'custom' && webhook.customHeaders) {
                headers = webhook.customHeaders as any;
            }

            // Determine Method
            let method = body ? 'POST' : 'GET';
            if (webhook.provider === 'custom' && webhook.settings?.method) {
                method = webhook.settings.method;
            }

            const options: RequestInit = {
                method,
                headers: body ? headers : undefined,
                body: body ? JSON.stringify(body) : undefined,
            };

            const response = await fetch(url, options);

            if (!response.ok) {
                console.error(`[Notification] Failed to send to ${webhook.name}: ${response.status} ${response.statusText}`);
            } else {
                console.log(`[Notification] Sent to ${webhook.name} successfully.`);
            }
        } catch (error) {
            console.error(`[Notification] Error sending to ${webhook.name}:`, error);
        }
    }

    private buildPayload(webhook: WebhookConfig, event: NotificationEvent, payload: OrderPayload): any {
        // Use custom template if available or required for custom provider
        if (webhook.provider === 'custom' && webhook.customPayload) {
            return JSON.parse(this.replaceVariables(webhook.customPayload, event, payload));
        }

        // Special handling for Message Event
        if (event === 'on_message') {
            const title = `New Message from ${payload.sender || 'User'}`;
            const text = `${payload.message || ''}`;

            switch (webhook.provider) {
                case 'slack':
                    return { text: `*${title}*\n${text}` };
                case 'dingtalk':
                    return {
                        msgtype: "markdown",
                        markdown: {
                            title: title,
                            text: `### ${title}\n\n${text}\n\n> ${new Date().toLocaleTimeString()}`
                        }
                    };
                case 'wecom':
                    return {
                        msgtype: "markdown",
                        markdown: {
                            content: `### ${title}\n> ${text}`
                        }
                    };
                case 'feishu':
                    return {
                        msg_type: "interactive",
                        card: {
                            header: {
                                title: { tag: "plain_text", content: title },
                                template: "blue"
                            },
                            elements: [{ tag: "div", text: { tag: "lark_md", content: text } }]
                        }
                    };
                case 'telegram':
                    return {
                        text: `*${title}*\n${text}`.replace(/_/g, '\\_'),
                        parse_mode: 'Markdown'
                    };
                case 'bark':
                    return {
                        title: title,
                        body: text,
                        group: "iProTraX",
                        icon: "https://day.app/assets/images/avatar.jpg"
                    };
                default:
                    return {
                        title: title,
                        text: text,
                        data: payload
                    };
            }
        }

        // Default Defaults for Orders
        const title = `ProTracker Alert: ${event.toUpperCase().replace('ON_', '')}`;
        const text = `Order: ${payload.orderId}\nStep: ${payload.step || 'N/A'}\nStatus: ${payload.status || 'Updated'}\nProduct: ${payload.productName || 'N/A'}`;

        // ... rest of existing switch logic ...
        switch (webhook.provider) {
            case 'slack':
                return {
                    text: `*${title}*\n${text}`
                };
            case 'teams': // Generic Connector Card
                return {
                    "@type": "MessageCard",
                    "@context": "http://schema.org/extensions",
                    "themeColor": "0076D7",
                    "summary": title,
                    "sections": [{
                        "activityTitle": title,
                        "activitySubtitle": `ProTracker Notification`,
                        "facts": [
                            { "name": "Order ID", "value": payload.orderId },
                            { "name": "Step", "value": payload.step },
                            { "name": "Status", "value": payload.status },
                        ],
                        "markdown": true
                    }]
                };
            case 'dingtalk':
                return {
                    msgtype: "markdown",
                    markdown: {
                        title: title,
                        text: `### ${title}\n\n- **Order**: ${payload.orderId}\n- **Step**: ${payload.step}\n- **Status**: ${payload.status}\n- **Time**: ${new Date().toLocaleTimeString()}`
                    }
                };
            case 'wecom':
                return {
                    msgtype: "markdown",
                    markdown: {
                        content: `### ${title}\n> Order: <font color="comment">${payload.orderId}</font>\n> Step: ${payload.step}\n> Status: <font color="warning">${payload.status}</font>`
                    }
                };
            case 'feishu': // Feishu / Lark
                return {
                    msg_type: "interactive",
                    card: {
                        header: {
                            title: { tag: "plain_text", content: title },
                            template: event === 'on_hold' || event === 'on_qn' ? "red" : "blue"
                        },
                        elements: [
                            {
                                tag: "div",
                                text: {
                                    tag: "lark_md",
                                    content: `**Order**: ${payload.orderId}\n**Step**: ${payload.step}\n**Status**: ${payload.status}\n**Time**: ${new Date().toLocaleTimeString()}`
                                }
                            }
                        ]
                    }
                };
            case 'telegram':
                // Telegram requires chat_id which is usually in the URL for webhooks, 
                // but standard webhook URL is https://api.telegram.org/bot<token>/sendMessage
                // The body needs 'chat_id' if not provided contextually, but usually users put full URL.
                // We will send text.
                return {
                    text: `*${title}*\nOrder: \`${payload.orderId}\`\nStep: ${payload.step}\nStatus: ${payload.status}`.replace(/_/g, '\\_'), // Basic Markdown escaping
                    parse_mode: 'Markdown'
                };
            case 'discord':
                return {
                    embeds: [{
                        title: title,
                        color: event === 'on_hold' || event === 'on_qn' ? 15158332 : 3447003, // Red or Blue
                        fields: [
                            { name: "Order ID", value: payload.orderId, inline: true },
                            { name: "Step", value: payload.step || "N/A", inline: true },
                            { name: "Status", value: payload.status || "Info", inline: true }
                        ],
                        timestamp: new Date().toISOString()
                    }]
                };
            case 'bark':
                // Bark (iOS) - Simple GET/POST
                // URL usually: https://api.day.app/Key/Title/Body
                // But if using POST, body is JSON.
                return {
                    title: title,
                    body: `${text}`,
                    group: "iProTraX",
                    icon: "https://day.app/assets/images/avatar.jpg"
                };
            case 'gotify':
                return {
                    title: title,
                    message: text,
                    priority: event === 'on_hold' || event === 'on_qn' ? 8 : 5
                };
            case 'serverchan': // Turbo version
                return {
                    title: title,
                    desp: `**Order**: ${payload.orderId}\n\n**Step**: ${payload.step}\n\n**Status**: ${payload.status}`
                };
            case 'pushdeer':
                return {
                    text: title,
                    desp: text,
                    type: 'markdown'
                };
            case 'matrix': // Matrix / Element
                // Standard Matrix webhook payload usually involves 'text' or 'formatted_body'
                return {
                    msgtype: "m.text",
                    body: `${title}\n${text}`,
                    format: "org.matrix.custom.html",
                    formatted_body: `<h3>${title}</h3><p>Order: <b>${payload.orderId}</b><br>Step: ${payload.step}<br>Status: ${payload.status}</p>`
                };
            default:
                // Fallback struct
                return {
                    title,
                    text,
                    data: payload
                };
        }
    }

    private replaceVariables(template: string, event: NotificationEvent, payload: OrderPayload): string {
        let result = template;
        const map: Record<string, string> = {
            '{{orderId}}': payload.orderId,
            '{{step}}': payload.step || '',
            '{{status}}': payload.status || '',
            '{{productName}}': payload.productName || '',
            '{{event}}': event,
            '{{operator}}': payload.operator || 'Unknown',
            '{{timestamp}}': new Date().toISOString()
        };

        for (const [key, value] of Object.entries(map)) {
            result = result.replace(new RegExp(key, 'g'), value);
        }
        return result;
    }
}
