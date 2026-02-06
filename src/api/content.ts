import { Hono } from 'hono';
import { db } from '../db/client.js';
import { lanes, cards } from '../db/schema.js';
import { asc, eq } from 'drizzle-orm';
import { authenticateApiKey } from '../middleware/auth.js';
import { verify } from 'hono/jwt';
import { DEFAULT_LANES, DEFAULT_CARDS } from '../config/bentoDefaults.js';
import { savingsTracker } from '../lib/llm/savings-tracker.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_do_not_use_in_prod';

/**
 * Replace placeholder stat cards with real data from Redis.
 * Falls back gracefully — if Redis is down, placeholders stay.
 */
async function injectLiveStats(cardsData: any[]): Promise<any[]> {
    try {
        const daily = await savingsTracker.getDailySavings();

        const statsMap: Record<string, { title: string; content: string }> = {
            'stat-requests': {
                title: daily.cacheHits > 0 ? daily.cacheHits.toLocaleString() : '—',
                content: daily.cacheHits > 0
                    ? `${daily.cacheHits.toLocaleString()} requests served from the edge today.`
                    : 'Requests served from the edge today.'
            },
            'stat-savings': {
                title: daily.totalSavedUsd > 0 ? `$${daily.totalSavedUsd.toFixed(2)}` : '$0',
                content: daily.totalSavedUsd > 0
                    ? `$${daily.totalSavedUsd.toFixed(2)} saved across all users today.`
                    : 'Total user savings today from cache hits.'
            },
        };

        return cardsData.map(card => {
            const override = statsMap[card.id];
            if (override) {
                return {
                    ...card,
                    data: { ...card.data, title: override.title, content: override.content }
                };
            }
            return card;
        });
    } catch (err) {
        console.warn('[Content] Live stats injection failed, using placeholders:', err);
        return cardsData;
    }
}

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

        // AUTO-SEED: If empty, hydrate the DB with defaults
        if (lanesData.length === 0) {
            console.log('[ContentAPI] Database empty. Auto-seeding defaults...');
            await Promise.all([
                ...DEFAULT_LANES.map(l => db.insert(lanes).values(l as any).onConflictDoNothing()),
                ...DEFAULT_CARDS.map(c => db.insert(cards).values(c as any).onConflictDoNothing())
            ]);

            // Re-fetch
            const [newLanes, newCards] = await Promise.all([
                db.select().from(lanes).orderBy(asc(lanes.id)),
                db.select().from(cards)
            ]);

            return c.json({ lanes: newLanes, cards: newCards });
        }

        return c.json({
            lanes: lanesData,
            cards: await injectLiveStats(cardsData)
        });
    } catch (error: any) {
        console.warn('Failed to fetch content from DB (returning defaults):', error);
        // Fallback to in-memory defaults on ANY fail (Timeout, Auth, Connection)
        return c.json({
            lanes: DEFAULT_LANES,
            cards: await injectLiveStats(DEFAULT_CARDS)
        });
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
