import { WebhookConfig, getConfig } from '@/lib/config';
import { createHmac } from 'node:crypto';

type NotificationEvent = 'on_hold' | 'on_qn' | 'on_done' | 'on_step_update' | 'on_message' | 'on_morning_report';

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
     * Uses the first configured event trigger to generate a realistic payload.
     */
    public async sendTest(webhook: WebhookConfig) {
        // Use the first configured event, or default to 'on_hold'
        const testEvent: NotificationEvent = (webhook.events?.[0] as NotificationEvent) || 'on_hold';

        // Generate realistic test payload based on event type
        const now = new Date();
        const testPayload: OrderPayload = {
            orderId: `WO-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-001`,
            step: this.getTestStepForEvent(testEvent),
            status: this.getTestStatusForEvent(testEvent),
            productName: 'Standard Production Line',
            operator: 'System Test',
            message: this.getTestMessageForEvent(testEvent)
        };

        console.log(`[Notification/Test] Sending ${testEvent} test to ${webhook.name}`);
        await this.dispatchWebhook(webhook, testEvent, testPayload);
    }

    private getTestStepForEvent(event: NotificationEvent): string {
        const stepMap: Record<NotificationEvent, string> = {
            'on_hold': 'QC Inspection',
            'on_qn': 'Assembly',
            'on_done': 'Final Packaging',
            'on_step_update': 'Machining',
            'on_morning_report': 'Daily Summary',
            'on_message': 'General'
        };
        return stepMap[event] || 'Processing';
    }

    private getTestStatusForEvent(event: NotificationEvent): string {
        const statusMap: Record<NotificationEvent, string> = {
            'on_hold': 'ON HOLD',
            'on_qn': 'QN RAISED',
            'on_done': 'COMPLETED',
            'on_step_update': 'IN PROGRESS',
            'on_morning_report': 'REPORT',
            'on_message': 'INFO'
        };
        return statusMap[event] || 'Updated';
    }

    private getTestMessageForEvent(event: NotificationEvent): string {
        const msgMap: Record<NotificationEvent, string> = {
            'on_hold': '⚠️ Order paused at QC Inspection due to material shortage.',
            'on_qn': '🔴 Quality issue detected in Assembly step. Review required.',
            'on_done': '✅ Order completed successfully and ready for shipment.',
            'on_step_update': '🔄 Machining step completed. Moving to next stage.',
            'on_morning_report': '📊 Daily production summary for ' + new Date().toLocaleDateString(),
            'on_message': '📨 New message from production team.'
        };
        return msgMap[event] || 'Test notification from iProTraX.';
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

            // SSRF Protection: Moved to just before fetch() to cover all modifications


            let body = this.buildPayload(webhook, event, payload);
            let headers: any = { 'Content-Type': 'application/json' };

            // Dynamic URL Construction & Provider Specifics
            // Dynamic URL Construction & Provider Specifics
            if (webhook.provider === 'bark' && webhook.settings?.deviceKey) {
                const rawServerUrl = webhook.settings.serverUrl || 'https://api.day.app';
                // ReDoS Fix: Safe removal of trailing slashes without vulnerable regex
                let safeServerUrl = rawServerUrl;
                while (safeServerUrl.endsWith('/')) {
                    safeServerUrl = safeServerUrl.slice(0, -1);
                }

                const deviceKey = webhook.settings.deviceKey;

                // Intelligent URL Construction:
                // Case 1: Server URL already contains the Device Key (user pasted full URL)
                //         → Use the URL directly as the base, just append Title/Body
                // Case 2: Server URL is just the host (e.g., https://api.day.app)
                //         → Append Key/Title/Body as usual

                let baseUrl: string;
                if (safeServerUrl.includes(deviceKey)) {
                    // User's URL already has the key embedded, use it directly
                    baseUrl = safeServerUrl;
                    console.log('[Notification/Bark] Server URL contains Key, using directly.');
                } else {
                    // Standard case: append key
                    baseUrl = `${safeServerUrl}/${deviceKey}`;
                }

                // ReDoS Fix: Ensure no trailing slashes on baseUrl
                while (baseUrl.endsWith('/')) {
                    baseUrl = baseUrl.slice(0, -1);
                }

                // Build Title and Body
                const titleStr = webhook.name || body?.title || `iProTraX: ${event}`;
                const bodyStr = body?.body || body?.text || `Order: ${payload.orderId}`;

                const title = encodeURIComponent(titleStr);
                const textBody = encodeURIComponent(bodyStr);

                const sound = webhook.settings.sound || 'minuet';
                const icon = webhook.settings.icon ? `&icon=${encodeURIComponent(webhook.settings.icon)}` : '';
                const group = body?.group ? `&group=${encodeURIComponent(body.group)}` : '&group=iProTraX';

                url = `${baseUrl}/${title}/${textBody}?sound=${sound}${icon}${group}`;

                console.log('[Notification/Bark] GET: [BASE]/%s/%s', title, textBody);

                // Body must be undefined for GET
                body = undefined;

            } else if (webhook.provider === 'dingtalk') {
                // ... (DingTalk logic remains same)
                if (webhook.settings?.signSecret) {
                    const { timestamp, sign } = this.signDingTalk(webhook.settings.signSecret);
                    const separator = url.includes('?') ? '&' : '?';
                    url = `${url}${separator}timestamp=${timestamp}&sign=${sign}`;
                }

            } else if (webhook.provider === 'feishu') {
                // ... (Feishu logic remains same)
                if (webhook.settings?.signSecret) {
                    const { timestamp, sign } = this.signFeishu(webhook.settings.signSecret);
                    body = {
                        timestamp,
                        sign,
                        ...body
                    };
                }

            } else if (webhook.provider === 'telegram' && webhook.settings?.botToken && webhook.settings?.chatId) {
                url = `https://api.telegram.org/bot${webhook.settings.botToken}/sendMessage`;
                body = {
                    chat_id: webhook.settings.chatId,
                    ...body
                };
            } else if (webhook.provider === 'gotify' && webhook.settings?.serverUrl && webhook.settings?.appToken) {
                // ReDoS Fix for Gotify URL
                let serverUrl = webhook.settings.serverUrl;
                while (serverUrl.endsWith('/')) {
                    serverUrl = serverUrl.slice(0, -1);
                }
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

            // SSRF Protection: Validate FINAL URL before request
            // This ensures no provider logic has redirected to an internal IP
            if (!await this.validateWebhookUrl(url)) {
                console.error('[Notification] Blocked potential SSRF attempt to internal/private URL: %s', url);
                return;
            }

            const response = await fetch(url, options);

            if (!response.ok) {
                // Tainted Format String Fix: Use %s
                console.error('[Notification] Failed to send to %s: %s %s', webhook.name, response.status, response.statusText);
            } else {
                console.log('[Notification] Sent to %s successfully.', webhook.name);
            }
        } catch (error) {
            // Tainted Format String Fix: Use %s
            console.error('[Notification] Error sending to %s:', webhook.name, error);
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
                    // Telegram Escaping Fix: Use helper
                    return {
                        text: `*${this.escapeTelegramMarkdown(title)}*\n${this.escapeTelegramMarkdown(text)}`,
                        parse_mode: 'MarkdownV2', // Use V2 for better escaping support
                        disable_web_page_preview: true
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
                // Telegram Escaping Fix: Use helper and V2
                return {
                    text: `*${this.escapeTelegramMarkdown(title)}*\nOrder: \`${this.escapeTelegramMarkdown(payload.orderId)}\`\nStep: ${this.escapeTelegramMarkdown(payload.step || 'N/A')}\nStatus: ${this.escapeTelegramMarkdown(payload.status || 'N/A')}`,
                    parse_mode: 'MarkdownV2'
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

    /**
     * Escape special characters for Telegram MarkdownV2
     */
    private escapeTelegramMarkdown(text: string): string {
        // Escape backslash first, then other special characters
        // MarkdownV2 requires escaping: _ * [ ] ( ) ~ ` > # + - = | { } . ! \
        return text.replace(/[\\_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
    }

    /**
     * Validate Webhook URL to prevent SSRF
     * Rejects local/private IPs
     */
    private async validateWebhookUrl(urlStr: string): Promise<boolean> {
        try {
            const url = new URL(urlStr);

            // Protocol Check (SSRF Protection)
            if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                return false;
            }

            // Block localhost/127.0.0.1 immediately
            if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]') {
                return false;
            }

            // For extra security, resolve DNS to check real IP
            // Note: In strict envs, this should verify against private subnets (10.x, 192.168.x, 172.16.x)
            // Here we do a basic check.
            const dns = await import('dns');
            const { promisify } = await import('util');
            const lookup = promisify(dns.lookup);

            const { address } = await lookup(url.hostname);

            // Basic Private IP Regex
            const isPrivate = /^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|127\.|169\.254\.)/.test(address);
            return !isPrivate;

        } catch (e) {
            console.error('[Notification] URL Validation failed: %s', e);
            return false;
        }
    }
}
