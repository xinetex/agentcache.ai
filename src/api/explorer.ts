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
import { db } from '../db/client.js';
import { knowledgeNodes } from '../db/schema.js';
import { desc } from 'drizzle-orm';

const app = new Hono();

// GET /api/explorer/nodes - List cache nodes
app.get('/nodes', async (c) => {
    try {
        const limit = parseInt(c.req.query('limit') || '50');
        const offset = parseInt(c.req.query('offset') || '0');

        const nodes = await db.select()
            .from(knowledgeNodes)
            .orderBy(desc(knowledgeNodes.lastVerifiedAt))
            .limit(limit)
            .offset(offset);

        return c.json({ nodes });
    } catch (error: any) {
        console.error('Explorer API Error:', error);
        return c.json({ error: error.message }, 500);
    }
});

export default app;
