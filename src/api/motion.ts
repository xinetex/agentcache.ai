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
import { MotionService } from '../services/sectors/robotics/MotionService.js';
import { authenticateApiKey } from '../middleware/auth.js';

const motionRouter = new Hono();
const motionService = new MotionService();

/**
 * POST /api/motion/plan
 * Request a path from A to B.
 * Returns cached path if available (saving compute).
 */
motionRouter.post('/plan', async (c) => {
    // Optional: Auth Gate (uncomment to enforce payment)
    // const authError = await authenticateApiKey(c);
    // if (authError) return authError;

    try {
        const body = await c.req.json();

        // Basic Validation
        if (body.sx === undefined || body.gx === undefined) {
            return c.json({ error: "Start/Goal required" }, 400);
        }

        const result = await motionService.planPath(body);

        return c.json(result);
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

/**
 * GET /api/motion/stats
 * Returns telemetry and latest path for visualization.
 */
motionRouter.get('/stats', async (c) => {
    try {
        const stats = await motionService.getStats();
        return c.json(stats);
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

export { motionRouter };
