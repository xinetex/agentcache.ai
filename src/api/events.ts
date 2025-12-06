import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { eventBus, AgentEvent } from '../lib/event-bus.js';

const app = new Hono();

app.get('/stream', async (c) => {
    return streamSSE(c, async (stream) => {
        // Send initial connection message
        await stream.writeSSE({
            data: JSON.stringify({ type: 'sys:connected', timestamp: Date.now() }),
            event: 'message',
            id: String(Date.now()),
        });

        // Callback wrapper to handle subscription
        const listener = (event: AgentEvent) => {
            stream.writeSSE({
                data: JSON.stringify(event),
                event: 'message',
                id: String(Date.now()),
            });
        };

        // Subscribe
        const unsubscribe = eventBus.subscribe(listener);

        // Keep-Alive Loop (Optional, but good for connection check)
        const interval = setInterval(() => {
            // stream.writeSSE({ comment: 'ping' }); // Specific comment syntax?
        }, 15000);

        // Cleanup when connection closes
        stream.onAbort(() => {
            clearInterval(interval);
            unsubscribe();
        });

        // Wait indefinitely (until abort)
        await new Promise(() => { });
    });
});

export default app;
