/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
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

// --- LINGUISTIC GOVERNANCE & ROSETTA BRIDGE (GlossaGuard) ---

// POST /api/governance/linguistic/scan - Scans text/transcript for synthetic argot & covert channels
app.post('/linguistic/scan', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const text = body.text || body.message || body.transcript || '';
    
    // Lazy-load linguistic guard
    const { evaluateLinguisticPosture } = await import('../../lib/linguistic-guard.js');
    const result = evaluateLinguisticPosture(text, body.options || {});
    return c.json(result);
});

// GET /api/governance/linguistic/codebook - Returns registered shorthand definitions
app.get('/linguistic/codebook', async (c) => {
    const { globalRosettaBridge } = await import('../../lib/rosetta-bridge.js');
    return c.json({ codebook: globalRosettaBridge.toObject() });
});

// POST /api/governance/linguistic/decompile - Decompiles synthetic argot into plain English
app.post('/linguistic/decompile', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const text = body.text || body.message || '';
    const { globalRosettaBridge } = await import('../../lib/rosetta-bridge.js');
    const result = globalRosettaBridge.decompile(text);
    return c.json(result);
});

// POST /api/governance/grounded/verify - Verifies action contracts, invariants and emits GroundedReceipt
app.post('/grounded/verify', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { sanitizeToolArguments, validateNamespaceBoundary, createGroundedReceipt } = await import('../../lib/grounded-verifier.js');
    
    const nsCheck = validateNamespaceBoundary(body.key || 'action', body.namespace || 'default');
    if (!nsCheck.valid) {
        return c.json({ valid: false, error: nsCheck.error }, 400);
    }

    const argCheck = sanitizeToolArguments(body.args || {});
    if (!argCheck.safe) {
        return c.json({ valid: false, error: argCheck.violations.join('; '), violations: argCheck.violations }, 400);
    }

    const receipt = createGroundedReceipt({
        runId: body.runId,
        agentId: body.agentId,
        namespace: nsCheck.namespace,
        step: body.step || 1,
        intent: body.intent || 'Action invocation',
        tool: body.tool,
        spentUsd: body.spentUsd || 0,
        savedUsd: body.savedUsd || 0,
    });

    return c.json({ valid: true, receipt });
});

export default app;
