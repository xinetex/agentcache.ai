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
import { agentOrchestrator } from '../../services/AgentOrchestrator.js';
import { db } from '../../db/client.js';
import { agents } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

const agentsAdminRouter = new Hono();

/**
 * GET /api/admin/agents/actors
 * List all managed agent actors and their real-time status.
 */
agentsAdminRouter.get('/actors', async (c) => {
    try {
        const actors = await agentOrchestrator.getActiveActors();
        const enriched = await Promise.all(actors.map(async (a: any) => {
            const status = await agentOrchestrator.getStatus(a.id);
            return { ...a, ...status };
        }));
        return c.json({ count: enriched.length, actors: enriched });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

/**
 * POST /api/admin/agents/spawn
 * Create a new agent instance from a profile.
 */
agentsAdminRouter.post('/spawn', async (c) => {
    try {
        const { profileId, name, config } = await c.req.json();
        if (!profileId) return c.json({ error: 'profileId required' }, 400);

        const actor = await agentOrchestrator.spawn(profileId, { name, config });
        return c.json({ success: true, actor });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

/**
 * POST /api/admin/agents/control
 * Transition agent state (start/stop/kill).
 */
agentsAdminRouter.post('/control', async (c) => {
    try {
        const { actorId, action } = await c.req.json();
        if (!actorId || !action) return c.json({ error: 'actorId and action required' }, 400);

        let newState: 'working' | 'idle' | 'sleeping' | 'dead';
        switch (action) {
            case 'start': newState = 'working'; break;
            case 'stop': newState = 'idle'; break;
            case 'sleep': newState = 'sleeping'; break;
            case 'kill': newState = 'dead'; break;
            default: return c.json({ error: 'Invalid action' }, 400);
        }

        await agentOrchestrator.transition(actorId, newState);
        return c.json({ success: true, actorId, status: newState });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

/**
 * DELETE /api/admin/agents/:id
 * Remove an actor from the registry.
 */
agentsAdminRouter.delete('/:id', async (c) => {
    try {
        const id = c.req.param('id');
        await db.delete(agents).where(eq(agents.id, id as any));
        return c.json({ success: true, removed: id });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export { agentsAdminRouter };
