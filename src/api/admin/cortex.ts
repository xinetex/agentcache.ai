import { Hono } from 'hono';

export const cortexRouter = new Hono();

// Mock Memory Stats
cortexRouter.get('/stats', async (c) => {
    // In a real implementation, we'd query Redis/Vector DB sizes
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
        active_nodes: [
            { id: 'mem_1', type: 'concept', label: 'Rust Lang', weight: 0.98 },
            { id: 'mem_2', type: 'entity', label: 'Solana', weight: 0.85 },
            { id: 'mem_3', type: 'pattern', label: 'Auth Flow', weight: 0.72 },
            { id: 'mem_4', type: 'concept', label: 'Agentic UI', weight: 0.65 },
            { id: 'mem_5', type: 'entity', label: 'Stripe', weight: 0.60 }
        ]
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
