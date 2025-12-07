
export const config = { runtime: 'nodejs' };

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

/**
 * SSE Endpoint for Live Traces
 */
export default async function handler(req) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            // Send initial connection message
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'sys:connected' })}\n\n`));

            const interval = setInterval(async () => {
                try {
                    // Poll Redis for recent traces
                    // We use LRANGE to get the last 10, but in a real stream we'd want only new ones.
                    // Ideally we'd use Redis Pub/Sub, but over serverless HTTP that's hard.
                    // Approach: Just dump the top 5 recent traces every 2 seconds. 
                    // The frontend controls deduplication.

                    const res = await fetch(`${UPSTASH_URL}/lrange/traces:recent/0/4`, {
                        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
                    });
                    const data = await res.json();
                    const traces = data.result || [];

                    if (traces.length > 0) {
                        // Send as a single batch update or individual events
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'traces', data: traces })}\n\n`));
                    }
                } catch (err) {
                    console.error('Stream Error:', err);
                }
            }, 2000);

            req.signal.addEventListener('abort', () => {
                clearInterval(interval);
                controller.close();
            });
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        }
    });
}
