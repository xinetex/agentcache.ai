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
import { lemmaService } from '../services/LemmaService.js';
import { authenticateApiKey } from '../middleware/auth.js';

const lemmaRouter = new Hono();

/**
 * POST /api/lemma/chat
 * Resolves a complex prompt by mathematically decomposing it into sub-tasks (Lemmas),
 * caching them independently, and synthesizing a fluid final response.
 */
lemmaRouter.post('/chat', async (c) => {
    const authError = await authenticateApiKey(c);
    if (authError) return authError;

    try {
        const body = await c.req.json();
        const prompt = body.prompt || body.message;
        const provider = body.provider || 'openai';
        const model = body.model || 'gpt-4o-mini';

        if (!prompt || typeof prompt !== 'string') {
            return c.json({ error: 'Valid prompt/message is required' }, 400);
        }

        const result = await lemmaService.chat(prompt, provider, model);

        return c.json({
            success: true,
            ...result
        });
    } catch (error: any) {
        console.error('[Lemma API Error]', error);
        return c.json({ error: error.message }, 500);
    }
});

export default lemmaRouter;
