/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 */

import { Hono } from 'hono';
import { shodanService } from '../services/ShodanService.js';
import { bancacheService } from '../services/BancacheService.js';
import { authenticateApiKey } from '../middleware/auth.js';

const sentryRouter = new Hono();

/**
 * GET /api/sentry/risk/:ip
 * Get infrastructure risk profile for an IP
 */
sentryRouter.get('/risk/:ip', async (c) => {
    const authError = await authenticateApiKey(c);
    if (authError) return authError;

    const ip = c.req.param('ip');
    try {
        const risk = await shodanService.getRiskProfile(ip);
        return c.json(risk);
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

/**
 * POST /api/sentry/analyze
 * Analyze a server banner for risks
 */
sentryRouter.post('/analyze', async (c) => {
    const authError = await authenticateApiKey(c);
    if (authError) return authError;

    try {
        const { banner } = await c.req.json();
        if (!banner) return c.json({ error: 'banner text required' }, 400);

        const intelligence = await bancacheService.analyzeBanner(banner);
        return c.json(intelligence);
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

export default sentryRouter;
