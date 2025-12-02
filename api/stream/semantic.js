import Redis from 'ioredis';

export const config = {
    runtime: 'nodejs',
};

export default function handler(req) {
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        });
    }

    if (req.method !== 'GET') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const stream = new ReadableStream({
        async start(controller) {
            // Connect to Redis
            const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;
            if (!redisUrl) {
                controller.error(new Error('Redis URL not configured'));
                return;
            }

            const redis = new Redis(redisUrl);

            // Subscribe to channel
            try {
                await redis.subscribe('semantic-cache-events');
                console.log('[SSE] Subscribed to semantic-cache-events');
            } catch (err) {
                console.error('[SSE] Redis subscribe error:', err);
                controller.error(err);
                return;
            }

            // Handle messages
            redis.on('message', (channel, message) => {
                if (channel === 'semantic-cache-events') {
                    const data = `data: ${message}\n\n`;
                    controller.enqueue(new TextEncoder().encode(data));
                }
            });

            // Keep connection alive with heartbeats
            const heartbeat = setInterval(() => {
                controller.enqueue(new TextEncoder().encode(': heartbeat\n\n'));
            }, 15000);

            // Cleanup on close
            req.signal.addEventListener('abort', () => {
                console.log('[SSE] Client disconnected');
                clearInterval(heartbeat);
                redis.disconnect();
            });
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
        },
    });
}
