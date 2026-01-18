import { Hono } from 'hono';
import { db } from '../db/client.js';
import { organizations, users, members, apiKeys } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { authMiddleware, requireRole } from './auth.js';

const app = new Hono<{ Variables: { user: any } }>();

// Apply Auth Middleware to all routes
app.use('*', authMiddleware);

// GET /api/governance/org - Get current org details
app.get('/org', requireRole('viewer'), async (c) => {
    const user = c.get('user');

    // Fetch real org data
    const member = await db.select().from(members).where(eq(members.userId, user.id)).limit(1);
    if (!member.length) return c.json({ error: 'No org found' }, 404);

    const org = await db.select().from(organizations).where(eq(organizations.id, member[0].orgId)).limit(1);

    return c.json({
        ...org[0],
        role: member[0].role
    });
});

// GET /api/governance/members - List team members
app.get('/members', requireRole('viewer'), async (c) => {
    const user = c.get('user');

    // Fetch members of the user's org
    const orgMembers = await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: members.role
    })
        .from(members)
        .innerJoin(users, eq(members.userId, users.id))
        .where(eq(members.orgId, user.orgId));

    return c.json({ members: orgMembers });
});

// GET /api/governance/keys - List API keys
app.get('/keys', requireRole('admin'), async (c) => {
    const user = c.get('user');

    const keys = await db.select().from(apiKeys).where(eq(apiKeys.orgId, user.orgId));

    return c.json({
        apiKeys: keys.map(k => ({
            ...k,
            hash: '********' // Redact hash
        }))
    });
});

// POST /api/governance/presets - Switch Reality (Mock for now)
app.post('/presets', requireRole('owner'), async (c) => {
    const body = await c.req.json();
    return c.json({ success: true, mode: body.mode });
});

// GET /api/governance/presets - Get current mode
app.get('/presets', requireRole('viewer'), async (c) => {
    return c.json({ mode: 'Darwin' });
});

export default app;
