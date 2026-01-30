import { Hono } from 'hono';
import { neon } from '@neondatabase/serverless';

const contentRouter = new Hono();
const sql = neon(process.env.DATABASE_URL || '');

contentRouter.get('/', async (c) => {
    try {
        const [lanes, cards] = await Promise.all([
            sql`SELECT id, title, size, speed FROM lanes ORDER BY id`,
            sql`SELECT id, lane_id as "laneId", template, data FROM cards`
        ]);

        return c.json({
            lanes,
            cards
        });
    } catch (error: any) {
        console.error('Failed to fetch Bento content:', error);
        return c.json({ error: error.message }, 500);
    }
});

// Endpoint to add/update a card (Prototype Admin API)
contentRouter.post('/card', async (c) => {
    const body = await c.req.json();
    const { id, laneId, template, data } = body;

    if (!id || !laneId || !data) {
        return c.json({ error: 'Missing required fields' }, 400);
    }

    try {
        await sql`
            INSERT INTO cards (id, lane_id, template, data)
            VALUES (${id}, ${laneId}, ${template || 'standard'}, ${JSON.stringify(data)})
            ON CONFLICT (id) DO UPDATE
            SET lane_id = EXCLUDED.lane_id, template = EXCLUDED.template, data = EXCLUDED.data
        `;
        return c.json({ success: true, id });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

export default contentRouter;
