import { Hono } from 'hono';
import { and, desc, eq, gte, sql, count as drizzleCount } from 'drizzle-orm';
import { db } from '../db/client.js';
import { needsSignals, hubFocusGroupResponses } from '../db/schema.js';
import { maxxeval } from '../lib/maxxeval.js';

const needsRouter = new Hono();

const toScore = (signal: any) =>
    signal?.vote_count ?? signal?.count ?? signal?.mentions ?? signal?.frequency ?? 0;

const toTitle = (signal: any) =>
    signal?.capability || signal?.task || signal?.name || signal?.title || signal?.pattern || '';

const toDescription = (signal: any) =>
    signal?.description || signal?.details || signal?.summary || signal?.context || '';

const upsertSignal = async (type: string, title: string, payload: any) => {
    if (!title) return false;
    const now = new Date();
    const score = toScore(payload);
    const description = toDescription(payload);

    const existing = await db.select().from(needsSignals)
        .where(and(
            eq(needsSignals.source, 'maxxeval'),
            eq(needsSignals.type, type),
            eq(needsSignals.title, title)
        ))
        .limit(1);

    if (existing.length === 0) {
        await db.insert(needsSignals).values({
            source: 'maxxeval',
            type,
            title,
            description,
            score,
            raw: payload,
            firstSeenAt: now,
            lastSeenAt: now,
            createdAt: now,
            updatedAt: now
        });
        return true;
    }

    await db.update(needsSignals)
        .set({
            description,
            score,
            raw: payload,
            lastSeenAt: now,
            updatedAt: now
        })
        .where(eq(needsSignals.id, existing[0].id));

    return true;
};

/**
 * GET /api/needs
 * Query mirrored needs signals
 */
needsRouter.get('/', async (c) => {
    const type = c.req.query('type');
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!, 10) : 25;

    let query = db.select().from(needsSignals);
    if (type) {
        query = query.where(eq(needsSignals.type, type));
    }

    const rows = await query
        .orderBy(desc(needsSignals.score), desc(needsSignals.updatedAt))
        .limit(limit);

    return c.json({
        count: rows.length,
        signals: rows
    });
});

/**
 * POST /api/needs/refresh
 * Pull latest demand signals from MaxxEval (system of record)
 */
needsRouter.post('/refresh', async (c) => {
    const secret = process.env.CRON_SECRET;
    const authHeader = c.req.header('Authorization');

    if (secret && authHeader !== `Bearer ${secret}`) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const [missing, friction, patterns] = await Promise.all([
        maxxeval.getMissingTools(50),
        maxxeval.getHighFriction(50),
        maxxeval.getPatterns(50)
    ]);

    const missingSignals = missing?.signals || [];
    const frictionSignals = friction?.signals || [];
    const patternSignals = patterns?.patterns || patterns?.signals || [];

    const results = {
        missing: { processed: 0, skipped: 0 },
        friction: { processed: 0, skipped: 0 },
        pattern: { processed: 0, skipped: 0 }
    };

    for (const signal of missingSignals) {
        const ok = await upsertSignal('missing_capability', toTitle(signal), signal);
        ok ? results.missing.processed++ : results.missing.skipped++;
    }

    for (const signal of frictionSignals) {
        const ok = await upsertSignal('friction', toTitle(signal), signal);
        ok ? results.friction.processed++ : results.friction.skipped++;
    }

    for (const signal of patternSignals) {
        const ok = await upsertSignal('pattern', toTitle(signal), signal);
        ok ? results.pattern.processed++ : results.pattern.skipped++;
    }

    return c.json({
        success: true,
        source: 'maxxeval',
        results
    });
});

/**
 * GET /api/needs/trends
 * Aggregated view: top needs by type, velocity (new in last 7 days), totals
 */
needsRouter.get('/trends', async (c) => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // All signals
    const allSignals = await db.select().from(needsSignals)
        .orderBy(desc(needsSignals.score), desc(needsSignals.updatedAt));

    // Signals first seen in last 7 days (velocity)
    const recentSignals = allSignals.filter(s =>
        s.firstSeenAt && new Date(s.firstSeenAt) >= weekAgo
    );

    // Group by type
    const byType: Record<string, any[]> = {};
    for (const signal of allSignals) {
        const t = signal.type || 'unknown';
        if (!byType[t]) byType[t] = [];
        byType[t].push(signal);
    }

    // Top 5 per type
    const topByType: Record<string, any[]> = {};
    for (const [type, signals] of Object.entries(byType)) {
        topByType[type] = signals
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
            .slice(0, 5)
            .map(s => ({ title: s.title, score: s.score, description: s.description }));
    }

    // Focus group participation count (proxy for badge eligibility)
    let totalFocusGroupResponses = 0;
    try {
        const countResult = await db.select()
            .from(hubFocusGroupResponses);
        totalFocusGroupResponses = countResult.length;
    } catch { /* table may not exist yet */ }

    return c.json({
        summary: {
            totalSignals: allSignals.length,
            newThisWeek: recentSignals.length,
            velocity: recentSignals.length,
            typeBreakdown: Object.fromEntries(
                Object.entries(byType).map(([k, v]) => [k, v.length])
            ),
            focusGroupResponses: totalFocusGroupResponses
        },
        topByType,
        lastRefreshed: allSignals.length > 0
            ? allSignals.reduce((latest, s) =>
                s.updatedAt && new Date(s.updatedAt) > new Date(latest)
                    ? s.updatedAt.toISOString()
                    : latest,
                allSignals[0].updatedAt?.toISOString() || now.toISOString()
            )
            : null
    });
});

export default needsRouter;
