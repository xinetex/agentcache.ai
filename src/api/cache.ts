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
import { semanticCacheService } from '../services/SemanticCacheService.js';
import { resonanceService } from '../services/ResonanceService.js';
import { authenticateApiKey } from '../middleware/auth.js';

type Variables = {
    user: any;
    apiKey: string;
};

const cacheRouter = new Hono<{ Variables: Variables }>();

/**
 * POST /api/cache/check
 * Check if a completion request is already in the semantic cache.
 */
cacheRouter.post('/check', async (c) => {
    const authError = await authenticateApiKey(c);
    if (authError) return authError;

    try {
        const body = await c.req.json();
        const { messages, model, provider, temperature, semantic, previous_query } = body;

        if (!messages || !Array.isArray(messages)) {
            return c.json({ error: 'messages array required' }, 400);
        }

        const result = await semanticCacheService.check({ 
            messages, 
            model, 
            provider, 
            temperature, 
            semantic, 
            previous_query 
        });
        return c.json(result);
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

/**
 * POST /api/cache/set
 * Store a new response in the semantic cache.
 * Now includes support for Resonance Circles.
 */
cacheRouter.post('/set', async (c) => {
    const authError = await authenticateApiKey(c);
    if (authError) return authError;

    const apiKey = c.get('apiKey');

    try {
        const body = await c.req.json();
        const { messages, response, ttl, model, provider, temperature, circleId } = body;

        if (!messages || !response) {
            return c.json({ error: 'messages and response required' }, 400);
        }

        await semanticCacheService.set({ 
            messages, 
            response, 
            ttl, 
            model: model || 'gpt-4o', 
            provider: provider || 'openai',
            temperature,
            circleId,
            originAgent: apiKey // Implicitly track origin
        });

        return c.json({ success: true });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

/**
 * POST /api/cache/resonance
 * Lateral knowledge probe across a Nodal Circle.
 */
cacheRouter.post('/resonance', async (c) => {
    const authError = await authenticateApiKey(c);
    if (authError) return authError;

    const apiKey = c.get('apiKey');

    try {
        const body = await c.req.json();
        const { query, threshold } = body;

        if (!query) {
            return c.json({ error: 'query required' }, 400);
        }

        const hits = await resonanceService.calculateResonance(query, apiKey, threshold);
        return c.json({ hits });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

/**
 * POST /api/cache/circle/join
 */
cacheRouter.post('/circle/join', async (c) => {
    const authError = await authenticateApiKey(c);
    if (authError) return authError;

    const apiKey = c.get('apiKey');

    try {
        const { circleId } = await c.req.json();
        if (!circleId) return c.json({ error: 'circleId required' }, 400);

        await resonanceService.joinCircle(apiKey, circleId);
        return c.json({ success: true, message: `Joined circle: ${circleId}` });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

/**
 * POST /api/cache/circle/leave
 */
cacheRouter.post('/circle/leave', async (c) => {
    const authError = await authenticateApiKey(c);
    if (authError) return authError;

    const apiKey = c.get('apiKey');

    try {
        const { circleId } = await c.req.json();
        if (!circleId || typeof circleId !== 'string') return c.json({ error: 'circleId (string) required' }, 400);

        await resonanceService.leaveCircle(apiKey, circleId);
        return c.json({ success: true, message: `Left circle: ${circleId}` });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

/**
 * POST /api/cache/get
 * Retrieve a specific cached response by payload (messages).
 */
cacheRouter.post('/get', async (c) => {
    const authError = await authenticateApiKey(c);
    if (authError) return authError;

    try {
        const body = await c.req.json();
        const { messages, model, provider, temperature } = body;

        if (!messages) {
            return c.json({ error: 'messages required' }, 400);
        }

        const result = await semanticCacheService.check({ messages, model, provider, temperature });
        
        if (!result.hit) {
            return c.json(result, 404);
        }

        return c.json(result);
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

export default cacheRouter;
