
import { Hono } from 'hono';
import { semanticCacheService } from '../services/SemanticCacheService.js';
import { authenticateApiKey } from '../middleware/auth.js';

const cacheRouter = new Hono();

/**
 * POST /api/cache/check
 * Check if a completion request is already in the semantic cache.
 */
cacheRouter.post('/check', authenticateApiKey, async (c) => {
    try {
        const body = await c.req.json();
        const { messages, model, semantic } = body;

        if (!messages || !Array.isArray(messages)) {
            return c.json({ error: 'messages array required' }, 400);
        }

        const result = await semanticCacheService.check({ messages, model, semantic });
        return c.json(result);
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

/**
 * POST /api/cache/set
 * Store a new response in the semantic cache.
 */
cacheRouter.post('/set', authenticateApiKey, async (c) => {
    try {
        const body = await c.req.json();
        const { messages, response, ttl } = body;

        if (!messages || !response) {
            return c.json({ error: 'messages and response required' }, 400);
        }

        // Generate key from messages (SDK can also send the key if it calculated it, but we re-derive for safety)
        const key = semanticCacheService.constructor['generateKey'](messages);
        await semanticCacheService.set(key, response, ttl);

        return c.json({ success: true, key });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

/**
 * POST /api/cache/get
 * Retrieve a specific cached response by payload (messages).
 */
cacheRouter.post('/get', authenticateApiKey, async (c) => {
    try {
        const body = await c.req.json();
        const { messages, model } = body;

        if (!messages) {
            return c.json({ error: 'messages required' }, 400);
        }

        const result = await semanticCacheService.check({ messages, model });
        return c.json(result);
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

export default cacheRouter;
