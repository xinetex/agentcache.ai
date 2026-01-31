import { Hono } from 'hono';
const patternsRouter = new Hono();
let engine: any = null; // Use any to avoid type issues with lazy load
function getEngine() {
    if (!engine) {
        // Lazy load to prevent startup crash on Vercel
        const { PatternEngine } = require('../infrastructure/PatternEngine.js');
        engine = new PatternEngine();
    }
    return engine;
}

import { db } from '../db/client.js';
import { patterns } from '../db/schema.js';
import { desc } from 'drizzle-orm';

patternsRouter.get('/', async (c) => {
    try {
        const allPatterns = await db.select().from(patterns).orderBy(desc(patterns.lastInvokedAt));
        return c.json({ patterns: allPatterns });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

patternsRouter.post('/invoke', async (c) => {
    try {
        const body = await c.req.json();
        const { name, intent, actionSequence, triggerCondition } = body;

        if (!name || !intent) {
            return c.json({ error: 'Name and Intent are required.' }, 400);
        }

        const pattern = await getEngine().invoke(name, intent, actionSequence, triggerCondition);
        return c.json({ success: true, pattern });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

patternsRouter.post('/banish', async (c) => {
    try {
        const body = await c.req.json();
        const { identifier } = body;

        if (!identifier) return c.json({ error: 'Identifier required' }, 400);

        const result = await getEngine().banish(identifier);

        if (!result) return c.json({ error: 'Pattern not found' }, 404);

        return c.json({ success: true, banished: result });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

export { patternsRouter };
