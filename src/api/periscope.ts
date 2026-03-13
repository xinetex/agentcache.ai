/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * Periscope API Router
 */

import { Hono } from 'hono';
import { periscopeService } from '../services/PeriscopeService.js';
import { pathDistiller } from '../services/PathDistiller.js';
import { authenticateApiKey } from '../middleware/auth.js';

const router = new Hono();

/**
 * POST /api/periscope/score
 * Advisory endpoint to score next actions.
 */
router.post('/score', async (c) => {
    const authError = await authenticateApiKey(c);
    if (authError) return authError;

    try {
        const body = await c.req.json();
        const { candidates, weights, profile } = body;

        if (!candidates || !Array.isArray(candidates)) {
            return c.json({ error: 'Missing or invalid candidates array' }, 400);
        }

        const result = await periscopeService.scoreCandidates(candidates, { weights, profile });
        return c.json(result);
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

/**
 * POST /api/periscope/trace
 * Log a full run trace or individual step/action.
 * Useful for sidecar / async advisory roles.
 */
router.post('/trace', async (c) => {
    const authError = await authenticateApiKey(c);
    if (authError) return authError;

    try {
        const body = await c.req.json();
        const { type, data } = body;

        switch (type) {
            case 'start_run':
                const runId = await periscopeService.startRun(data.agentId, data.sessionId);
                return c.json({ success: true, runId });
            case 'log_step':
                const stepId = await periscopeService.logStep(
                    data.runId, 
                    data.index, 
                    data.stateSignature, 
                    data.goalTag, 
                    data.signature // Passing Phase 35 Signature
                );
                return c.json({ success: true, stepId });
            case 'log_action':
                await periscopeService.logAction(
                    data.stepId, 
                    data, 
                    data.signature // Passing Phase 35 Signature
                );
                return c.json({ success: true });
            default:
                return c.json({ error: 'Invalid trace type' }, 400);
        }
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

/**
 * POST /api/periscope/distill (Admin Only)
 */
router.post('/distill', async (c) => {
    // Basic admin check
    const token = c.req.header('Authorization')?.replace('Bearer ', '');
    if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    try {
        await pathDistiller.distillAll();
        return c.json({ success: true, message: 'Path distillation triggered successfully.' });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

export default router;
