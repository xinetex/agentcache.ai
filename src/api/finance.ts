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
import { RiskService } from '../services/sectors/finance/RiskService.js';

const financeRouter = new Hono();
const riskService = new RiskService();

/**
 * POST /api/finance/assess
 * Run Monte Carlo Risk Assessment.
 */
financeRouter.post('/assess', async (c) => {
    try {
        const body = await c.req.json();
        const result = await riskService.execute(body);
        return c.json(result);
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

/**
 * GET /api/finance/stats
 */
financeRouter.get('/stats', async (c) => {
    try {
        const stats = await riskService.getStats();
        return c.json(stats);
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

export { financeRouter };
