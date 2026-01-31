import { Hono } from 'hono';
import { db } from '../db/client.js';
import { lanes, cards } from '../db/schema.js';
import { asc, eq } from 'drizzle-orm';
import { authenticateApiKey } from '../middleware/auth.js';
import { verify } from 'hono/jwt';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_do_not_use_in_prod';

const contentRouter = new Hono<{ Variables: { user: any } }>();

contentRouter.get('/', async (c) => {
    try {
        console.log('[ContentAPI] Fetching content...');
        // Timeout wrapper for DB
        const dbPromise = Promise.all([
            db.select().from(lanes).orderBy(asc(lanes.id)),
            db.select().from(cards)
        ]);

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('DB_TIMEOUT')), 5000)
        );

        const [lanesData, cardsData] = await Promise.race([dbPromise, timeoutPromise]) as any;
        console.log('[ContentAPI] Content fetched successfully');

        return c.json({
            lanes: lanesData,
            cards: cardsData
        });
    } catch (error: any) {
        console.error('Failed to fetch Bento content:', error);
        return c.json({
            error: 'Database Fetch Error',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, 500);
    }
});

// Endpoint to add/update a card (Dual Auth: Admin Token OR API Key)
contentRouter.post('/card', async (c) => {
    const authHeader = c.req.header('Authorization');
    const token = authHeader?.split(' ')[1];
    const apiKey = c.req.header('X-API-Key');

    let isAdmin = false;

    // 1. Check Admin Token (Simplex)
    if (token === process.env.ADMIN_TOKEN) {
        isAdmin = true;
    } else if (token) {
        // 1.5 Check JWT (Admin/Owner)
        try {
            const payload = await verify(token, JWT_SECRET);
            if (payload.role === 'admin' || payload.role === 'owner') {
                isAdmin = true;
            }
        } catch (e) {
            // Invalid JWT, fall through to API Key check
        }
    }

    if (!isAdmin) {
        // 2. Check API Key (if not Admin)
        const authError = await authenticateApiKey(c);
        if (authError) return authError;
        // If we get here, API Key is valid and c.get('tier') is set
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

// Endpoint to delete a card
contentRouter.delete('/card/:id', async (c) => {
    const authHeader = c.req.header('Authorization');
    const token = authHeader?.split(' ')[1];
    const apiKey = c.req.header('X-API-Key');
    const cardId = c.req.param('id');

    // Auth Check
    let authorized = false;
    if (token === process.env.ADMIN_TOKEN) {
        authorized = true;
    } else if (token) {
        try {
            const payload = await verify(token, JWT_SECRET);
            if (payload.role === 'admin' || payload.role === 'owner') {
                authorized = true;
            }
        } catch (e) { /* Ignore */ }
    }

    if (!authorized) {
        const authError = await authenticateApiKey(c);
        if (!authError) authorized = true;
    }

    if (!authorized) return c.json({ error: 'Unauthorized' }, 401);

    try {
        await db.delete(cards).where(eq(cards.id, cardId));
        return c.json({ success: true, id: cardId });
    } catch (error: any) {
        console.error('Failed to delete card:', error);
        return c.json({ error: error.message }, 500);
    }
});

export default contentRouter;
