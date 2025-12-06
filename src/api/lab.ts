
import { Hono } from 'hono';
import { redis } from '../lib/redis.js';

const labRouter = new Hono();

/**
 * GET /api/lab/genomes
 * Retrieve top evolved pipeline genomes
 */
labRouter.get('/genomes', async (c) => {
    try {
        const limit = parseInt(c.req.query('limit') || '10');

        // Get Top Genomes by Fitness from Sorted Set
        // Assuming 'lab:genomes:index' stores IDs scored by fitness
        const genomeIds = await redis.zrevrange('lab:genomes:index', 0, limit - 1);

        if (genomeIds.length === 0) {
            // Mock data if empty for visualization testing
            return c.json({
                genomes: [],
                message: "No evolved genomes found. Start a Swarm Experiment."
            });
        }

        // Fetch actual genome data
        const pipeline = redis.pipeline();
        genomeIds.forEach((id) => {
            pipeline.get(`lab:genomes:${id}`);
        });

        const results = await pipeline.exec();
        const genomes = results
            .map(([err, data]) => data ? JSON.parse(data as string) : null)
            .filter(g => g !== null);

        return c.json({ genomes });

    } catch (error: any) {
        console.error('[Lab] Error fetching genomes:', error);
        return c.json({ error: error.message }, 500);
    }
});

export default labRouter;
