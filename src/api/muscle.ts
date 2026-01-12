
import { Hono } from 'hono';

// Target JettyThunder URL (default to localhost:3000)
const JETTY_URL = process.env.JETTY_URL || 'http://localhost:3000';
const JETTY_ADMIN_KEY = process.env.JETTY_ADMIN_KEY || process.env.ADMIN_KEY;

const muscleRouter = new Hono();

// Proxy helper
const proxyToJetty = async (c: any, path: string) => {
    const url = `${JETTY_URL}${path}`;
    const method = c.req.method;

    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    if (JETTY_ADMIN_KEY) {
        headers.set('X-Admin-Key', JETTY_ADMIN_KEY);
    }

    const options: RequestInit = {
        method,
        headers,
    };

    if (method !== 'GET' && method !== 'HEAD') {
        const body = await c.req.json();
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(url, options);
        const data = await response.json();
        return c.json(data, response.status as any);
    } catch (error: any) {
        return c.json({ error: 'Failed to connect to Muscle (JettyThunder)', details: error.message }, 502);
    }
};

/**
 * Plan & Execute (GOAP)
 * Agent says: "Ensure ad served for user X" -> Muscle figures out how.
 * POST /api/muscle/plan -> POST /api/admin/goap/execute
 */
muscleRouter.post('/plan', async (c) => {
    return proxyToJetty(c, '/api/admin/goap/execute');
});

/**
 * Reflex Action (Swarm)
 * Agent says: "Ping fleet" -> Muscle broadcasts immediately.
 * POST /api/muscle/reflex -> POST /api/admin/swarm/test
 */
muscleRouter.post('/reflex', async (c) => {
    return proxyToJetty(c, '/api/admin/swarm/test');
});

export default muscleRouter;
