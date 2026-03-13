/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * B2B API: Service Provisioning and Market Context.
 */

import { Hono } from 'hono';
import { b2bServiceOrchestrator } from '../services/B2BServiceOrchestrator.js';

const router = new Hono();

/**
 * POST /api/b2b/provision
 * Provision a new B2B specialized swarm.
 */
router.post('/provision', async (c) => {
    const config = await c.req.json();
    if (!config.clientId || !config.type) {
        return c.json({ error: 'Missing clientId or type' }, 400);
    }

    const result = await b2bServiceOrchestrator.provisionService(config);
    return c.json(result);
});

/**
 * GET /api/b2b/market-context
 * Returns metrics for the Industrial Dashboard.
 */
router.get('/market-context', async (c) => {
    const stats = await b2bServiceOrchestrator.getMarketStats();
    return c.json({
        success: true,
        stats
    });
});

export default router;
