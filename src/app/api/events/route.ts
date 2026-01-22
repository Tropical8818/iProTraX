import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { subscriber } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const session = await getSession();
    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    const encoder = new TextEncoder();

    // Create a streaming response
    const customStream = new TransformStream();
    const writer = customStream.writable.getWriter();

    // Subscribe to Redis channel
    const channel = 'system-updates';

    // We need a dedicated subscriber instance or ensure single subscription?
    // Redis subscriber instance can listen to multiple channels, but here 
    // we want to push messages to THIS stream when a message arrives.
    // The global 'subscriber' is shared. We should add a listener to it.

    const onMessage = (chan: string, message: string) => {
        if (chan === channel) {
            // Send SSE event
            const data = `data: ${message}\n\n`;
            writer.write(encoder.encode(data)).catch(err => {
                console.error('Error writing to stream', err);
            });
        }
    };

    // Ensure we are subscribed
    // Note: If multiple clients connect, we only need to SUBSCRIBE once globally, 
    // but identifying if it's already subscribed is tricky.
    // ioredis subscriber handles this? 
    // Actually, 'subscriber' is a singleton. If we call subscribe multiple times it's fine.
    subscriber.subscribe(channel);
    subscriber.on('message', onMessage);

    // Cleanup on disconnect
    request.signal.addEventListener('abort', () => {
        subscriber.off('message', onMessage);
        // We generally don't unsubscribe globally because other clients might be listening
        writer.close().catch(() => { });
    });

    return new NextResponse(customStream.readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
