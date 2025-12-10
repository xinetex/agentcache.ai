import { Hono } from 'hono';
import { PatternEngine } from '../infrastructure/PatternEngine.js'; // Importing TS source as JS because of how Vite/TS might handle it or just ..ts if using bundler?
// Wait, api/patterns.js is JS. importing .ts file from JS requires build step or runtime support (tsx).
// Since the project uses mixed JS/TS, I'll assume standard interop.
// But importing '../src/infrastructure/PatternEngine.js' implies it's compiled.
// If I use `api/patterns.js` (JS), I cannot easily import TS source unless using `tsx` or similar.
// Maybe I should make `api/patterns.ts` (TS) so it can import other TS files.
// Let's TRY making `api/patterns.ts`. It's safer for importing `PatternEngine.ts`.

const patternsRouter = new Hono();
const engine = new PatternEngine();

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

        const pattern = await engine.invoke(name, intent, actionSequence, triggerCondition);
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

        const result = await engine.banish(identifier);

        if (!result) return c.json({ error: 'Pattern not found' }, 404);

        return c.json({ success: true, banished: result });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

export { patternsRouter };
