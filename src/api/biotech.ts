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
import { FoldingService } from '../services/sectors/biotech/FoldingService.js';

const biotechRouter = new Hono();
const foldingService = new FoldingService();

/**
 * POST /api/biotech/fold
 * Request a protein structure prediction.
 */
biotechRouter.post('/fold', async (c) => {
    try {
        const body = await c.req.json();

        if (!body.sequence) {
            return c.json({ error: "Protein sequence required" }, 400);
        }

        const result = await foldingService.execute(body);
        return c.json(result);
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

/**
 * GET /api/biotech/stats
 * Returns telemetry (GPU Hours Saved).
 */
biotechRouter.get('/stats', async (c) => {
    try {
        const stats = await foldingService.getStats();
        return c.json(stats);
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

export { biotechRouter };
