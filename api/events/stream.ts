import { eventBus, AgentEvent } from '../../src/lib/event-bus';

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // SSE Headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Subscribe to event bus
    const unsubscribe = eventBus.subscribe((event: AgentEvent) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'sys:connected', timestamp: Date.now() })}\n\n`);

    // Cleanup on close
    req.on('close', () => {
        unsubscribe();
        res.end();
    });
}
