import { Hono } from 'hono';
import { swarmService, SwarmConfig } from '../../services/SwarmService.js';

const swarmAdminRouter = new Hono();

/**
 * GET /api/admin/swarm/active
 * List all currently active swarms.
 */
swarmAdminRouter.get('/active', async (c) => {
    try {
        const swarms = await swarmService.listActiveSwarms();
        return c.json({ count: swarms.length, swarms });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

/**
 * POST /api/admin/swarm/spawn
 * Trigger a new multi-agent swarm for a specific goal.
 */
swarmAdminRouter.post('/spawn', async (c) => {
    try {
        const config = await c.req.json() as SwarmConfig;
        if (!config.goal || !config.participants) {
            return c.json({ error: 'goal and participants required' }, 400);
        }

        const swarm = await swarmService.spawnSwarm(config);
        return c.json({ success: true, swarm });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

/**
 * GET /api/admin/swarm/:id
 * Get detailed status for a specific swarm.
 */
swarmAdminRouter.get('/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const status = await swarmService.getSwarmStatus(id);
        if (!status) return c.json({ error: 'Swarm not found' }, 404);
        return c.json({ success: true, status });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export { swarmAdminRouter };
