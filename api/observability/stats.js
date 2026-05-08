export const config = { runtime: 'nodejs' };

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const OBSERVABILITY_STATS_CACHE_KEY = 'observability:stats:v1';
const OBSERVABILITY_FETCH_TIMEOUT_MS = Number(process.env.OBSERVABILITY_FETCH_TIMEOUT_MS || 1500);

function jsonResponse(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, X-Agent-Onboard, X-Agent-Manifest',
            'Cache-Control': 'public, max-age=30, must-revalidate',
        },
    });
}

function buildFallbackPayload() {
    const timestamp = new Date().toISOString();

    return {
        total_users: 0,
        active_sessions: 0,
        system_health: 'DEGRADED',
        db_latency: '0ms',
        cache_hits_today: 0,
        cache_misses_today: 0,
        cache_hit_rate: 0,
        cost_savings_usd: 0,
        hit_rate: 0,
        cost_saved_today: '$0.00',
        top_users: [],
        growth_data: [],
        timestamp,
        fabric: {
            analytics: {
                asOf: timestamp,
                summary: {
                    totalOperations: 0,
                    reads: 0,
                    writes: 0,
                    browserProofs: 0,
                    hits: 0,
                    misses: 0,
                    hitRate: 0,
                    estimatedTokensSaved: 0,
                    estimatedUsdSaved: 0,
                    estimatedLatencySavedMs: 0,
                },
                timeline: [],
                topNamespaces: [],
                topSectors: [],
                topSkus: [],
            },
            accounting: {
                totalCredits: 0,
                bySku: [],
                bySector: [],
                recentOperations: [],
            },
        },
        browserProof: {
            proofs: 0,
            byExecutionMode: [],
            byEngine: [],
            byHomeostasisStatus: [],
            averageConfidence: 0,
            failureRate: 0,
        },
        alignment: {
            total: 0,
            validated: 0,
            blocked: 0,
            estimated: 0,
            storedBenchmarks: 0,
            recentRuns: [],
            recentBenchmarks: [],
        },
        executionDrift: {
            totalEvaluations: 0,
            stableEvaluations: 0,
            watchEvaluations: 0,
            driftingEvaluations: 0,
            averageSurpriseScore: 0,
            recentEvaluations: [],
        },
        externalAgents: {
            total: 0,
            verified: 0,
            pending: 0,
            withSoulprint: 0,
            bySystem: [],
            bySector: [],
            byBiasFlag: [],
        },
        receipts: {
            totalReceipts: 0,
            bySubjectKind: [],
            browser: {
                proofs: 0,
                byExecutionMode: [],
                byEngine: [],
                byHomeostasisStatus: [],
                averageConfidence: 0,
                failureRate: 0,
            },
        },
        moltbook: {
            active_spirits_count: 0,
            total_predictions: 0,
            current_vibes: 0,
            status: 'degraded',
            recent_spirits: [],
            spillover_traffic: 0,
            redirection_yield: '0%',
            last_sync: timestamp,
        },
        liquidity: {
            total_provisioned_sol: 0,
            active_provisions_count: 0,
            latest_provisions: [],
        },
        eventCounts: {},
        latency: 0,
        lastEvent: null,
        degraded: true,
        source: 'standalone-observability',
    };
}

async function redis(command, ...args) {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
    const path = `${command}/${args.map(a => encodeURIComponent(String(a))).join('/')}`;
    const res = await fetch(`${UPSTASH_URL}/${path}`, {
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
        signal: AbortSignal.timeout(OBSERVABILITY_FETCH_TIMEOUT_MS),
    });
    const data = await res.json();
    return data.result;
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') {
        return jsonResponse({}, 200);
    }

    if (req.method !== 'GET') {
        return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const fallbackPayload = buildFallbackPayload();

    try {
        const cached = await redis('GET', OBSERVABILITY_STATS_CACHE_KEY);
        if (cached) {
            try {
                return jsonResponse(typeof cached === 'string' ? JSON.parse(cached) : cached);
            } catch {
                return jsonResponse(fallbackPayload);
            }
        }
    } catch {
        return jsonResponse(fallbackPayload);
    }

    try {
        const now = new Date();
        const dateKey = now.toISOString().split('T')[0];
        const pipeline = [
            ['GET', `stats:hits:d:${dateKey}`],
            ['GET', `stats:misses:d:${dateKey}`],
            ['GET', `stats:tokens:d:${dateKey}`],
            ['GET', `stats:cost:d:${dateKey}`],
        ];

        const res = await fetch(`${UPSTASH_URL}/pipeline`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
            body: JSON.stringify(pipeline),
            signal: AbortSignal.timeout(OBSERVABILITY_FETCH_TIMEOUT_MS),
        });
        const results = await res.json();

        const hits = Number(results?.[0]?.result || 0);
        const misses = Number(results?.[1]?.result || 0);
        const tokens = Number(results?.[2]?.result || 0);
        const cost = Number(results?.[3]?.result || 0);

        const total = hits + misses;
        const hitRate = total > 0 ? (hits / total) * 100 : 0;
        const payload = {
            ...fallbackPayload,
            cache_hits_today: hits,
            cache_misses_today: misses,
            cache_hit_rate: hitRate,
            hit_rate: hitRate,
            cost_savings_usd: cost,
            cost_saved_today: `$${cost.toFixed(2)}`,
            fabric: {
                ...fallbackPayload.fabric,
                analytics: {
                    ...fallbackPayload.fabric.analytics,
                    summary: {
                        ...fallbackPayload.fabric.analytics.summary,
                        hits,
                        misses,
                        hitRate,
                        estimatedTokensSaved: tokens,
                        estimatedUsdSaved: cost,
                    },
                },
            },
        };

        return jsonResponse(payload);
    } catch {
        return jsonResponse(fallbackPayload);
    }
}
