/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * Dream API: Orchestration endpoint for the Functorial Dreamer.
 */

import { Hono } from 'hono';
import { dreamService } from '../services/DreamService.js';
import { authenticateApiKey } from '../middleware/auth.js';

const router = new Hono();

/**
 * POST /api/dream/invoke
 * Manually trigger the dream cycle to synthesize patterns from traces.
 */
router.post('/invoke', async (c) => {
    const authError = await authenticateApiKey(c);
    if (authError) return authError;

    const body = await c.req.json().catch(() => ({}));
    const limit = body.limit || 20;

    try {
        console.log(`[DreamAPI] 🌀 Manual dream invocation started (limit: ${limit})...`);
        const result = await dreamService.dream(limit);
        
        return c.json({
            success: true,
            patternsCreated: result.patternsCreated,
            insights: result.insights,
            timestamp: new Date().toISOString()
        });
    } catch (e: any) {
        console.error("[DreamAPI] Dream cycle failed:", e);
        return c.json({ error: 'Dream cycle failed', message: e.message }, 500);
    }
});

export default router;
