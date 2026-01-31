
import { Hono } from 'hono';
import { db } from '../db/client.js';
import { bannerAnalysis } from '../db/schema.js';
import { BancacheService } from '../services/bancache.js';
import { AnalystAgent } from '../agents/analyst.js';

const intelligenceRouter = new Hono();
const bancache = new BancacheService();
let analyst: AnalystAgent | null = null;
function getAnalyst() {
    if (!analyst) analyst = new AnalystAgent();
    return analyst;
}

/**
 * GET /api/intelligence/banner/:hash
 * Retrieve analysis for a specific banner hash
 */
intelligenceRouter.get('/banner/:hash', async (c) => {
    const hash = c.req.param('hash');
    const data = await bancache.getAnalysis(hash);

    if (!data) {
        return c.json({ error: 'Hash not found in cache' }, 404);
    }

    return c.json(data);
});

/**
 * POST /api/intelligence/ingest
 * Manually ingest a banner string to get its hash
 */
intelligenceRouter.post('/ingest', async (c) => {
    const { banner } = await c.req.json();
    if (!banner) return c.json({ error: 'banner is required' }, 400);

    const hash = await bancache.ingest(banner);

    // Check if analysis exists, if not trigger background analysis
    const existing = await bancache.getAnalysis(hash);
    if (!existing?.analysis) {
        // Trigger async analysis (fire and forget)
        getAnalyst().analyzeBanner(hash, banner).catch(console.error);
    }

    return c.json({
        success: true,
        hash,
        analyzed: !!existing?.analysis
    });
});

/**
 * POST /api/intelligence/process
 * Trigger the backlog processor (for cron/manual use)
 */
intelligenceRouter.post('/process', async (c) => {
    const count = await getAnalyst().processBacklog(5);
    return c.json({ processed: count });
});

/**
 * GET /api/intelligence/graph
 * Retrieve all analyzed banners for visualization
 */
intelligenceRouter.get('/graph', async (c) => {
    // Get all banners with analysis
    // In a real app we would limit this or tile it
    const nodes = await db.select().from(bannerAnalysis);

    // Format for 3D Graph
    const graphData = {
        nodes: nodes.map(n => ({
            id: n.bannerHash,
            group: n.classification || 'Unknown',
            val: (n.riskScore || 0) + 1, // Size based on risk (or seen_count if we joined)
            color: n.riskScore > 7 ? 'red' : n.riskScore > 4 ? 'orange' : 'green',
            name: `${n.classification} (Risk: ${n.riskScore})`,
            desc: n.reasoning
        })),
        links: [] // Future: Connect shared vulnerabilities or similar semantics
    };

    return c.json(graphData);
});

export default intelligenceRouter;
