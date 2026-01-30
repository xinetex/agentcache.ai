import { Hono } from 'hono';
import { db } from '../db/client.js';
import { lanes, cards } from '../db/schema.js';
import { asc } from 'drizzle-orm';

const contentRouter = new Hono<{ Variables: { user: any } }>();

contentRouter.get('/', async (c) => {
    try {
        const [lanesData, cardsData] = await Promise.all([
            db.select().from(lanes).orderBy(asc(lanes.id)),
            db.select().from(cards)
        ]);

        return c.json({
            lanes: lanesData,
            cards: cardsData
        });
    } catch (error: any) {
        console.error('Failed to fetch Bento content:', error);
        return c.json({
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, 500);
    }
});

// Endpoint to add/update a card (Protected Admin API)
contentRouter.post('/card', async (c) => {
    const authHeader = c.req.header('Authorization');
    const token = authHeader?.split(' ')[1];

    if (token !== process.env.ADMIN_TOKEN) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { id, laneId, template, data } = body;

    if (!id || !laneId || !data) {
        return c.json({ error: 'Missing required fields' }, 400);
    }

    try {
        await db.insert(cards).values({
            id,
            laneId,
            template: template || 'standard',
            data: data
        })
            .onConflictDoUpdate({
                target: cards.id,
                set: {
                    laneId,
                    template,
                    data
                }
            });

        return c.json({ success: true, id });
    } catch (error: any) {
        console.error('Failed to specific card:', error);
        return c.json({ error: error.message }, 500);
    }
});

export default contentRouter;
