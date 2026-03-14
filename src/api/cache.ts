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
import { listFabricSkus } from '../config/fabricSkus.js';
import { authenticateApiKey } from '../middleware/auth.js';
import { memoryFabricAnalyticsService } from '../services/MemoryFabricAnalyticsService.js';
import { memoryFabricPolicyService } from '../services/MemoryFabricPolicyService.js';

type Variables = {
    user: any;
    apiKey: string;
    tier?: string;
};

const cacheRouter = new Hono<{ Variables: Variables }>();

function resolveMemoryPolicy(c: any, body: Record<string, any>) {
    return memoryFabricPolicyService.resolve({
        sector: body.sector,
        verticalSku: body.verticalSku,
        requestedTtlSeconds: body.ttl,
        tierId: c.get('tier') || 'free',
    });
}

function extractPromptText(messages: any[]): string {
    return messages
        .map((message) => (typeof message?.content === 'string' ? message.content : JSON.stringify(message?.content ?? '')))
        .join('\n');
}

cacheRouter.get('/fabric/skus', (c) => {
    return c.json({
        success: true,
        skus: listFabricSkus(),
    });
});

cacheRouter.post('/fabric/profile', async (c) => {
    const authError = await authenticateApiKey(c);
    if (authError) return authError;

    try {
        const body = await c.req.json();
        const policy = resolveMemoryPolicy(c, body);

        return c.json({
            success: true,
            policy,
        });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

cacheRouter.get('/fabric/roi', async (c) => {
    const authError = await authenticateApiKey(c);
    if (authError) return authError;

    try {
        const sku = c.req.query('sku');
        const sectorId = c.req.query('sector');
        const snapshot = await memoryFabricAnalyticsService.getSnapshot({ sku, sectorId });
        return c.json({
            success: true,
            analytics: snapshot,
        });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

/**
 * POST /api/cache/check
 * Check if a completion request is already in the semantic cache.
 */
cacheRouter.post('/check', async (c) => {
    const authError = await authenticateApiKey(c);
    if (authError) return authError;

    try {
        const body = await c.req.json();
        const {
            messages,
            model,
            provider,
            temperature,
            semantic,
            previous_query,
            sessionId,
            turnIndex,
            target_ip,
            target_banner,
        } = body;

        if (!messages || !Array.isArray(messages)) {
            return c.json({ error: 'messages array required' }, 400);
        }

        const policy = resolveMemoryPolicy(c, body);

        const result = await semanticCacheService.check({ 
            messages, 
            model, 
            provider, 
            temperature, 
            sector: policy.sectorId,
            semantic, 
            previous_query,
            sessionId,
            turnIndex,
            target_ip,
            target_banner,
        });
        await memoryFabricAnalyticsService.recordOperation({
            policy,
            operation: 'read',
            hit: result.hit,
            promptText: extractPromptText(messages),
            responseText: typeof result.response === 'string' ? result.response : undefined,
        }).catch((error) => console.warn('[MemoryFabricAnalytics] Failed to record read:', error));
        return c.json({ ...result, policy });
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
        const { messages, response, model, provider, temperature, circleId, sessionId, turnIndex } = body;

        if (!messages || !response) {
            return c.json({ error: 'messages and response required' }, 400);
        }

        const policy = resolveMemoryPolicy(c, body);
        const key = await semanticCacheService.set({ 
            messages, 
            response, 
            ttl: policy.effectiveTtlSeconds, 
            model: model || 'gpt-4o', 
            provider: provider || 'openai',
            sector: policy.sectorId,
            temperature,
            circleId,
            originAgent: apiKey, // Implicitly track origin
            sessionId,
            turnIndex
        });
        await memoryFabricAnalyticsService.recordOperation({
            policy,
            operation: 'write',
            promptText: extractPromptText(messages),
            responseText: typeof response === 'string' ? response : JSON.stringify(response),
        }).catch((error) => console.warn('[MemoryFabricAnalytics] Failed to record write:', error));

        return c.json({
            success: true,
            key: key.slice(-16),
            policy,
        });
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

        const policy = resolveMemoryPolicy(c, body);
        const result = await semanticCacheService.check({
            messages,
            model,
            provider,
            temperature,
            sector: policy.sectorId,
        });
        await memoryFabricAnalyticsService.recordOperation({
            policy,
            operation: 'read',
            hit: result.hit,
            promptText: extractPromptText(messages),
            responseText: typeof result.response === 'string' ? result.response : undefined,
        }).catch((error) => console.warn('[MemoryFabricAnalytics] Failed to record read:', error));
        
        if (!result.hit) {
            return c.json({ ...result, policy }, 404);
        }

        return c.json({ ...result, policy });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

export default cacheRouter;
