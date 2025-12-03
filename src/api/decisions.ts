import { Hono } from 'hono';
import { db } from '../db/client.js';
import { decisions } from '../db/schema.js';
import { desc } from 'drizzle-orm';

const app = new Hono();

// GET /api/decisions - List recent decisions
app.get('/', async (c) => {
    try {
        const limit = parseInt(c.req.query('limit') || '50');
        const offset = parseInt(c.req.query('offset') || '0');

        const recentDecisions = await db.select()
            .from(decisions)
            .orderBy(desc(decisions.timestamp))
            .limit(limit)
            .offset(offset);

        return c.json({ decisions: recentDecisions });
    } catch (error: any) {
        console.error('Decisions API Error:', error);
        // Fallback to empty list if DB fails (e.g. table not created yet)
        return c.json({ decisions: [], error: error.message });
    }
});

// POST /api/decisions - Record a decision
app.post('/', async (c) => {
    try {
        const body = await c.req.json();
        const { agentId, action, reasoning, outcome } = body;

        if (!action) {
            return c.json({ error: 'Missing action' }, 400);
        }

        const result = await db.insert(decisions).values({
            agentId,
            action,
            reasoning,
            outcome,
            timestamp: new Date(),
        }).returning();

        return c.json({ decision: result[0] });
    } catch (error: any) {
        console.error('Decisions API Error:', error);
        return c.json({ error: error.message }, 500);
    }
});

export default app;
