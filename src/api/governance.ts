import { Hono } from 'hono';
import { db } from '../db/client.js';
import { organizations, users, members, apiKeys } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

const app = new Hono();

// Mock Auth Middleware (Replace with real auth later)
const getContextOrgId = (c) => 'org_123456789'; // TODO: Extract from JWT

// GET /api/governance/org - Get current org details
app.get('/org', async (c) => {
    // For now, return a mock org if DB is empty, or fetch real one
    // This ensures the UI has something to show immediately
    return c.json({
        id: 'org_123456789',
        name: 'Acme Corp',
        plan: 'Professional',
        role: 'Owner',
        region: 'US-East (N. Virginia)'
    });
});

// GET /api/governance/members - List team members
app.get('/members', async (c) => {
    // Mock data for now until we have real users seeded
    return c.json({
        members: [
            { id: 'u_1', name: 'Alice Admin', email: 'alice@acme.com', role: 'owner' },
            { id: 'u_2', name: 'Bob Builder', email: 'bob@acme.com', role: 'member' },
            { id: 'u_3', name: 'Charlie Cache', email: 'charlie@acme.com', role: 'viewer' },
        ]
    });
});

// GET /api/governance/keys - List API keys
app.get('/keys', async (c) => {
    // Mock data for now
    return c.json({
        apiKeys: [
            { prefix: 'ac_live_', created: '2025-11-01', scopes: ['cache:read', 'cache:write'] },
            { prefix: 'ac_test_', created: '2025-11-15', scopes: ['cache:read'] },
        ]
    });
});

// POST /api/governance/presets - Switch Reality (Mock for now)
app.post('/presets', async (c) => {
    const body = await c.req.json();
    // In a real app, this would update the org's config
    return c.json({ success: true, mode: body.mode });
});

// GET /api/governance/presets - Get current mode
app.get('/presets', async (c) => {
    return c.json({ mode: 'Darwin' });
});

export default app;
