import { useEffect } from 'react';

interface RealtimeUpdate {
    type: string;
    productId?: string;
    woId?: string;
    action?: string;
    batch?: boolean;
}

export function useRealtime(productId: string | undefined, onUpdate: () => void) {
    useEffect(() => {
        // Only connect if we have a productId or if we want global updates?
        // Usually we want to connect always, and filter messages.

        console.log('[Realtime] Connecting...');
        const eventSource = new EventSource('/api/events');

        eventSource.onopen = () => {
            console.log('[Realtime] Connected');
        };

        eventSource.onmessage = (event) => {
            try {
                // Heartbeats or raw data
                if (event.data === 'ping') return;

                const data: RealtimeUpdate = JSON.parse(event.data);

                // Filter logic
                if (data.type === 'ORDER_UPDATE') {
                    // Refresh if:
                    // 1. It's for the current product
                    // 2. OR it's a batch update (might affect us)
                    if (data.productId === productId || !data.productId) {
                        console.log('[Realtime] Received update, refreshing...', data);
                        onUpdate();
                    }
                }
            } catch (e) {
                console.error('[Realtime] Message parse error', e);
            }
        };

        eventSource.onerror = (err) => {
            console.error('[Realtime] Connection error', err);
            // EventSource auto-reconnects, but if it fails repeatedly we might want to close or backoff
            // reliable reconnection is built-in to browser EventSource usually
        };

        return () => {
            console.log('[Realtime] Disconnecting');
            eventSource.close();
        };
    }, [productId, onUpdate]);
}
