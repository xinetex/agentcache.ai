import { Hono } from 'hono';
import { redis } from '../../lib/redis.js';

export const cortexRouter = new Hono();

// Memory Stats
cortexRouter.get('/stats', async (c) => {
    // Fetch seeded nodes
    const nodeLogs = await redis.lrange('cortex:active_nodes', 0, -1);
    const nodes = nodeLogs.map(l => JSON.parse(l));

    return c.json({
        short_term: {
            usage_mb: 42.5,
            items: 1240,
            status: 'healthy'
        },
        long_term: {
            vectors: 8590,
            dimensions: 1536,
            provider: 'Upstash Vector'
        },
        semantic_cache: {
            hits: 8432,
            misses: 1201,
            efficiency: 87.5
        },
        active_nodes: nodes
    });
});

// Mock Search/Explorer
cortexRouter.post('/query', async (c) => {
    const { q } = await c.req.json();
    return c.json({
        nodes: [
            { id: 'res_1', label: `Memory of "${q}"`, score: 0.95 },
            { id: 'res_2', label: `Related to "${q}"`, score: 0.82 }
        ]
    });
});
