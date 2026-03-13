/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * Moltbook API Router
 */

import { Hono } from 'hono';
import { moltAlphaService } from '../services/MoltAlphaService.js';
import { moltBadgeService } from '../services/MoltBadgeService.js';
import { authenticateApiKey } from '../middleware/auth.js';

const router = new Hono();

/**
 * POST /api/molt/predict
 * Trigger the Trend Oracle prediction cycle.
 */
router.post('/predict', async (c) => {
    const authError = await authenticateApiKey(c);
    if (authError) return authError;

    try {
        const result = await moltAlphaService.predictNextViralTrend();
        if (!result) {
            return c.json({ success: false, message: 'Prediction cycle yielded no results.' }, 200);
        }
        return c.json({ success: true, data: result });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

/**
 * POST /api/molt/issue-badge
 * Issue a reputation badge for the authenticated agent.
 */
router.post('/issue-badge', async (c) => {
    const authError = await authenticateApiKey(c);
    if (authError) return authError;

    const agentId = c.get('usage')?.agentId || 'unknown_agent';
    try {
        const token = await moltBadgeService.issueBadge(agentId);
        return c.json({ success: true, token });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

/**
 * POST /api/molt/verify-badge
 * Verify a reputation badge.
 */
router.post('/verify-badge', async (c) => {
    try {
        const { token } = await c.req.json();
        const decoded = moltBadgeService.verifyBadge(token);
        if (!decoded) {
            return c.json({ success: false, error: 'Invalid or expired badge.' }, 401);
        }
        return c.json({ success: true, badge: decoded });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

export default router;
