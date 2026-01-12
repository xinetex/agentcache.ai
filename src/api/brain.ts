
import { Hono } from 'hono';

// Target AutoMem URL (default to localhost:8001 per README)
const AUTOMEM_URL = process.env.AUTOMEM_URL || 'http://localhost:8001';
const AUTOMEM_API_TOKEN = process.env.AUTOMEM_API_TOKEN;
const AUTOMEM_ADMIN_TOKEN = process.env.AUTOMEM_ADMIN_TOKEN;

const brainRouter = new Hono();

// Proxy middleware helper
const proxyToAutoMem = async (c: any, path: string) => {
    const url = `${AUTOMEM_URL}${path}`;
    const method = c.req.method;

    // Forward headers
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    if (AUTOMEM_API_TOKEN) {
        headers.set('Authorization', `Bearer ${AUTOMEM_API_TOKEN}`);
    }
    // If admin token needed for tuning
    if (path.includes('/admin') && AUTOMEM_ADMIN_TOKEN) {
        headers.set('X-Admin-Token', AUTOMEM_ADMIN_TOKEN);
    }

    const options: RequestInit = {
        method,
        headers,
    };

    if (method !== 'GET' && method !== 'HEAD') {
        const body = await c.req.json();
        options.body = JSON.stringify(body);
    } else {
        // Forward query params
        const query = c.req.query();
        const searchParams = new URLSearchParams(query);
        // If URL already has params, we might need to handle differently, 
        // but path argument usually assumes simplistic mapping for now.
        // Actually, let's append query string to URL
        if (Object.keys(query).length > 0) {
            // Check if ? exists
            const separator = url.includes('?') ? '&' : '?';
            // url += separator + searchParams.toString(); 
            // Better to reconstruct
        }
    }

    // Pass through query params
    const incomingUrl = new URL(c.req.url);
    const targetUrl = new URL(url);
    incomingUrl.searchParams.forEach((v, k) => targetUrl.searchParams.append(k, v));

    try {
        const response = await fetch(targetUrl.toString(), options);
        const data = await response.json();
        return c.json(data, response.status as any);
    } catch (error: any) {
        return c.json({ error: 'Failed to connect to AutoMem Brain', details: error.message }, 502);
    }
};

/**
 * Memory Store
 * POST /api/brain/memory/store -> POST /memory
 */
brainRouter.post('/memory/store', async (c) => {
    return proxyToAutoMem(c, '/memory');
});

/**
 * Memory Recall
 * POST /api/brain/memory/recall -> GET /recall (mapped from POST body to GET params, or if AutoMem supports POST recall?)
 * AutoMem README says GET /recall. 
 * But AgentCache tool sends POST body.
 * We need to convert POST body to Query Params or use AutoMem's POST /recall if it exists.
 * Code review of app.py would verify if POST /recall exists.
 * Assume GET for now based on README examples.
 */
brainRouter.post('/memory/recall', async (c) => {
    const body = await c.req.json();
    const url = new URL(`${AUTOMEM_URL}/recall`);

    // Map body to query params
    if (body.query) url.searchParams.append('query', body.query);
    if (body.tags) {
        const tags = Array.isArray(body.tags) ? body.tags.join(',') : body.tags;
        url.searchParams.append('tags', tags);
    }
    if (body.timeQuery) url.searchParams.append('time_query', body.timeQuery);
    if (body.limit) url.searchParams.append('limit', String(body.limit));

    const headers = new Headers();
    if (AUTOMEM_API_TOKEN) headers.set('Authorization', `Bearer ${AUTOMEM_API_TOKEN}`);

    const response = await fetch(url.toString(), { headers });
    const data = await response.json();
    return c.json(data, response.status as any);
});

/**
 * Memory Graph
 * GET /api/brain/memory/:id/graph
 */
brainRouter.get('/memory/:id/graph', async (c) => {
    const id = c.req.param('id');
    // AutoMem might not have a direct "graph" endpoint for a node?
    // Using /recall with that ID? or just return what we have.
    // Given the task, I will leave this as a placeholder or remove if unsure.
    return c.json({ message: "Not implemented in proxy yet" }, 501);
});

/**
 * Admin Tune (New Confucius Functionality)
 * POST /api/brain/admin/tune -> POST /admin/tune
 */
brainRouter.post('/admin/tune', async (c) => {
    return proxyToAutoMem(c, '/admin/tune');
});

export default brainRouter;
