import { Hono } from 'hono';
import { swarmService, SwarmConfig } from '../../services/SwarmService.js';
import { boidsEngine } from '../../services/BoidsEngine.js';
import { boidsNavigator } from '../../services/BoidsNavigator.js';
import { BitAgentPool } from '../../lib/swarm/BitAgent.js';
import { coherenceService } from '../../services/CoherenceService.js';
import { semanticCacheService } from '../../services/SemanticCacheService.js';
import { redis } from '../../lib/redis.js';

const swarmAdminRouter = new Hono();

// Global Boids State for Phase 6 Prototype
let boidsPool: BitAgentPool | null = null;
let boidsInterval: any = null;

function ensureBoids() {
    if (!boidsPool) {
        boidsPool = new BitAgentPool(1000000); // 1 Million Agents
        boidsPool.initialize(1000, 1000); // 1000x1000 coordinate space
        
        // Background Simulation Loop
        boidsInterval = setInterval(async () => {
            if (boidsPool) {
                boidsEngine.update(boidsPool, 1/60);
                boidsNavigator.steer(boidsPool);
                
                // Periodic Bayesian Re-nav (every 30s)
                if (Date.now() % 30000 < 50) {
                    await boidsNavigator.refreshIncumbents();
                }
            }
        }, 33); // ~30 FPS
    }
}

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
 * GET /api/admin/swarm/boids
 * Sampled view of the 1M agent pool for the dashboard visualizer.
 */
swarmAdminRouter.get('/boids', async (c) => {
    ensureBoids();
    
    // Sample 2000 agents for the UI (sending 1M would crash the browser)
    const sampled: any[] = [];
    const step = Math.floor(boidsPool!.size / 2000);
    
    for (let i = 0; i < boidsPool!.size; i += step) {
        sampled.push(boidsPool!.getAgent(i));
    }

    // 3.5: Inject Health & Financial Metrics
    const health = await coherenceService.calculateDivergence('global-swarm');
    const cacheStats = await semanticCacheService.getGlobalStats();
    const totalSettled = await redis.get('stats:total_settled') || "0";
    const lastTx = await redis.get('stats:last_tx_hash') || null;

    return c.json({
        total: boidsPool!.size,
        sampled: sampled.length,
        agents: sampled,
        health,
        financials: {
            totalSettled: parseFloat(totalSettled as string),
            lastTx
        },
        cache: cacheStats
    });
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

/**
 * GET /api/admin/swarm/config
 * Get current boids engine configuration.
 */
swarmAdminRouter.get('/config', (c) => {
    return c.json(boidsEngine.getConfig());
});

/**
 * POST /api/admin/swarm/config
 * Update boids engine configuration in real-time.
 */
swarmAdminRouter.post('/config', async (c) => {
    try {
        const config = await c.req.json();
        boidsEngine.setConfig(config);
        return c.json({ success: true, config: boidsEngine.getConfig() });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export { swarmAdminRouter };
