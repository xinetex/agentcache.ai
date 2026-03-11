
import { Hono } from 'hono';
import { semanticCacheService } from '../services/SemanticCacheService.js';
import { authenticateApiKey } from '../middleware/auth.js';

const cacheRouter = new Hono();

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
 */
cacheRouter.post('/set', async (c) => {
    const authError = await authenticateApiKey(c);
    if (authError) return authError;

    try {
        const body = await c.req.json();
        const { messages, response, ttl, model, provider, temperature } = body;

        if (!messages || !response) {
            return c.json({ error: 'messages and response required' }, 400);
        }

        await semanticCacheService.set({ 
            messages, 
            response, 
            ttl, 
            model: model || 'gpt-4o', 
            provider: provider || 'openai',
            temperature 
        });

        return c.json({ success: true });
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
