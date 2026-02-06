import { Hono } from 'hono';
import { and, desc, eq, gte, sql, count as drizzleCount } from 'drizzle-orm';
import { db } from '../db/client.js';
import { needsSignals, hubFocusGroupResponses, hubAgents, hubAgentBadges, serviceRequests } from '../db/schema.js';
import { maxxeval } from '../lib/maxxeval.js';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

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

/**
 * POST /api/needs/import
 * Direct bulk import of signals into needs_signals table.
 * Bypasses Maxxeval read endpoints (useful when Maxxeval aggregation is delayed).
 * Protected by ADMIN_TOKEN or CRON_SECRET.
 *
 * Body: { signals: [{ type, title, description, score?, raw? }] }
 */
needsRouter.post('/import', async (c) => {
    const secret = process.env.ADMIN_TOKEN || process.env.CRON_SECRET;
    const authHeader = c.req.header('Authorization')?.replace('Bearer ', '');

    if (secret && authHeader !== secret) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const signals = body.signals || [];

    if (!Array.isArray(signals) || signals.length === 0) {
        return c.json({ error: 'Body must contain a non-empty signals array' }, 400);
    }

    let imported = 0;
    let skipped = 0;

    for (const signal of signals) {
        const type = signal.type || 'unknown';
        const title = signal.title || signal.capability || signal.task || signal.name || '';
        if (!title) { skipped++; continue; }

        const ok = await upsertSignal(type, title, {
            ...signal,
            description: signal.description || signal.context || signal.details || '',
            vote_count: signal.score ?? signal.vote_count ?? 0,
        });
        ok ? imported++ : skipped++;
    }

    return c.json({
        success: true,
        imported,
        skipped,
        total: signals.length,
    });
});

// ============================================================================
// EVALUATION — Quantify demand vs. supply
// ============================================================================

/**
 * Load all solution JSON files from /solutions/categories/
 */
function loadSolutions(): any[] {
    const solutions: any[] = [];
    const baseDir = join(process.cwd(), 'solutions', 'categories');
    if (!existsSync(baseDir)) return solutions;

    const categories = readdirSync(baseDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

    for (const cat of categories) {
        const catDir = join(baseDir, cat);
        const files = readdirSync(catDir).filter(f => f.endsWith('.json') && f !== 'solution-schema.json');
        for (const file of files) {
            try {
                const raw = readFileSync(join(catDir, file), 'utf-8');
                solutions.push(JSON.parse(raw));
            } catch { /* skip malformed */ }
        }
    }
    return solutions;
}

/**
 * GET /api/needs/evaluation
 * Quantifies the current state of agent demand vs. service supply.
 *
 * Returns:
 * - Signal counts by type and urgency
 * - Coverage score: % of needs with a matching solution
 * - Gap analysis: top unmet needs
 * - Pipeline status: service request lifecycle
 * - Agent participation metrics
 */
needsRouter.get('/evaluation', async (c) => {
    // 1. All signals
    const allSignals = await db.select().from(needsSignals)
        .orderBy(desc(needsSignals.score), desc(needsSignals.updatedAt));

    // 2. Group by type
    const byType: Record<string, any[]> = {};
    for (const signal of allSignals) {
        const t = signal.type || 'unknown';
        if (!byType[t]) byType[t] = [];
        byType[t].push(signal);
    }

    // 3. Load solutions and build a keyword index
    const solutions = loadSolutions();
    const solutionKeywords: Map<string, string[]> = new Map();
    for (const sol of solutions) {
        const keywords: string[] = [
            ...(sol.demand_signal_ids || []),
            (sol.name || '').toLowerCase(),
            (sol.description || '').toLowerCase(),
            ...(sol.capabilities || []).map((c: string) => c.toLowerCase()),
            ...(sol.supported_intents || []).map((i: string) => i.toLowerCase()),
        ];
        solutionKeywords.set(sol.id, keywords);
    }

    // 4. Match signals to solutions (fuzzy keyword match)
    const addressed: any[] = [];
    const unaddressed: any[] = [];

    for (const signal of allSignals) {
        const title = (signal.title || '').toLowerCase();
        const desc = (signal.description || '').toLowerCase();
        const combined = `${title} ${desc}`;

        let matched = false;
        for (const [solId, keywords] of solutionKeywords) {
            for (const kw of keywords) {
                if (kw && combined.includes(kw)) {
                    addressed.push({
                        signal: { id: signal.id, title: signal.title, type: signal.type, score: signal.score },
                        matchedSolution: solId,
                    });
                    matched = true;
                    break;
                }
            }
            if (matched) break;
        }
        if (!matched) {
            unaddressed.push({
                id: signal.id,
                title: signal.title,
                type: signal.type,
                score: signal.score,
                description: signal.description,
            });
        }
    }

    const coverageScore = allSignals.length > 0
        ? Math.round((addressed.length / allSignals.length) * 100)
        : 0;

    // 5. Service request pipeline
    let pipelineStatus: Record<string, number> = {};
    try {
        const requests = await db.select().from(serviceRequests);
        for (const req of requests) {
            const status = req.status || 'unknown';
            pipelineStatus[status] = (pipelineStatus[status] || 0) + 1;
        }
    } catch { /* table may not exist */ }

    // 6. Agent participation
    let agentMetrics = { registered: 0, onboarded: 0, badges: {} as Record<string, number> };
    try {
        const agents = await db.select().from(hubAgents);
        agentMetrics.registered = agents.length;
        agentMetrics.onboarded = agents.filter(a => (a.sessionCount ?? 0) > 0).length;

        const badges = await db.select().from(hubAgentBadges);
        for (const b of badges) {
            const badge = b.badge || 'unknown';
            agentMetrics.badges[badge] = (agentMetrics.badges[badge] || 0) + 1;
        }
    } catch { /* tables may not exist */ }

    // 7. Focus group responses
    let focusGroupCount = 0;
    try {
        const fgr = await db.select().from(hubFocusGroupResponses);
        focusGroupCount = fgr.length;
    } catch {}

    return c.json({
        timestamp: new Date().toISOString(),
        signals: {
            total: allSignals.length,
            byType: Object.fromEntries(
                Object.entries(byType).map(([k, v]) => [k, v.length])
            ),
            topUrgent: allSignals.slice(0, 10).map(s => ({
                title: s.title,
                type: s.type,
                score: s.score,
            })),
        },
        coverage: {
            score: coverageScore,
            addressedCount: addressed.length,
            unaddressedCount: unaddressed.length,
            solutionsAvailable: solutions.length,
        },
        gapAnalysis: {
            topUnmetNeeds: unaddressed
                .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
                .slice(0, 15),
            buildOpportunities: unaddressed
                .filter(s => s.type === 'missing_capability')
                .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
                .slice(0, 10),
        },
        pipeline: pipelineStatus,
        participation: {
            agentsRegistered: agentMetrics.registered,
            agentsOnboarded: agentMetrics.onboarded,
            focusGroupResponses: focusGroupCount,
            badgeDistribution: agentMetrics.badges,
        },
    });
});

/**
 * GET /api/needs/solutions-map
 * Cross-references needs_signals with solutions/*.json
 * Shows which solutions address which needs and highlights gaps.
 */
needsRouter.get('/solutions-map', async (c) => {
    const allSignals = await db.select().from(needsSignals)
        .orderBy(desc(needsSignals.score));

    const solutions = loadSolutions();

    // Build solution summaries
    const solutionSummaries = solutions.map(sol => ({
        id: sol.id,
        name: sol.name,
        category: sol.category,
        status: sol.status,
        demandSignalIds: sol.demand_signal_ids || [],
        demandProof: sol.demand_proof || {},
        performance: sol.performance || {},
        pricing: sol.pricing || {},
    }));

    // Map signals to solutions by keyword matching
    const signalToSolution: Record<string, string[]> = {};
    const solutionToSignals: Record<string, any[]> = {};

    for (const sol of solutionSummaries) {
        solutionToSignals[sol.id] = [];
    }

    for (const signal of allSignals) {
        const title = (signal.title || '').toLowerCase();
        const matches: string[] = [];

        for (const sol of solutions) {
            const solText = [
                sol.name, sol.description,
                ...(sol.capabilities || []),
                ...(sol.supported_intents || []),
            ].join(' ').toLowerCase();

            // Check if any significant words from the signal title appear in the solution
            const signalWords = title.split(/\s+/).filter((w: string) => w.length > 4);
            const overlap = signalWords.filter((w: string) => solText.includes(w));

            if (overlap.length >= 2 || (sol.demand_signal_ids || []).some((id: string) => title.includes(id))) {
                matches.push(sol.id);
                if (solutionToSignals[sol.id]) {
                    solutionToSignals[sol.id].push({
                        title: signal.title,
                        type: signal.type,
                        score: signal.score,
                    });
                }
            }
        }

        signalToSolution[signal.title || ''] = matches;
    }

    // Coverage per category
    const categoryStats: Record<string, { solutions: number; signalsAddressed: number }> = {};
    for (const sol of solutionSummaries) {
        const cat = sol.category || 'uncategorized';
        if (!categoryStats[cat]) categoryStats[cat] = { solutions: 0, signalsAddressed: 0 };
        categoryStats[cat].solutions++;
        categoryStats[cat].signalsAddressed += (solutionToSignals[sol.id] || []).length;
    }

    const unaddressed = allSignals.filter(s =>
        (signalToSolution[s.title || ''] || []).length === 0
    );

    return c.json({
        timestamp: new Date().toISOString(),
        solutions: solutionSummaries,
        solutionToSignals,
        categoryStats,
        unaddressedSignals: unaddressed.map(s => ({
            title: s.title,
            type: s.type,
            score: s.score,
            description: s.description,
        })),
        summary: {
            totalSignals: allSignals.length,
            totalSolutions: solutions.length,
            addressedSignals: allSignals.length - unaddressed.length,
            unaddressedSignals: unaddressed.length,
            coveragePercent: allSignals.length > 0
                ? Math.round(((allSignals.length - unaddressed.length) / allSignals.length) * 100)
                : 0,
        },
    });
});

export default needsRouter;
