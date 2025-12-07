/**
 * TraceService
 * 
 * Central observability service for the Neural Glass brain.
 * Aggregates:
 * 1. Distributed Traces (Full request/response details)
 * 2. Time-Series Metrics (Hits/Misses/Cost/Tokens for Analytics)
 * 3. Usage Quotas (User billing limits)
 */

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

/**
 * Lightweight Redis wrapper
 */
async function redis(command, ...args) {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
    const path = `${command}/${args.map(a => encodeURIComponent(String(a))).join('/')}`;
    try {
        const res = await fetch(`${UPSTASH_URL}/${path}`, {
            headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
        });
        const data = await res.json();
        return data.result;
    } catch (err) {
        console.error(`TraceService Redis Error (${command}):`, err);
        return null;
    }
}

/**
 * Execute batch pipeline
 */
async function redisPipeline(commands) {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
    try {
        const res = await fetch(`${UPSTASH_URL}/pipeline`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
            body: JSON.stringify(commands)
        });
        return await res.json();
    } catch (err) {
        console.error('TraceService Pipeline Error:', err);
        return null;
    }
}

export class TraceService {
    /**
     * Record a complete transaction.
     * - Saves full trace for debugging (TTL 24h)
     * - Increments Time-Series stats for Analytics
     * - Updates User Usage
     * @param {Object} event
     */
    static async record(event) {
        const now = new Date();
        const dateKey = now.toISOString().split('T')[0]; // YYYY-MM-DD
        const hourKey = `${dateKey}-${String(now.getHours()).padStart(2, '0')}`;
        const pipeline = [];

        // 1. Save Full Trace (Expiring)
        pipeline.push([
            'SETEX',
            `trace:${event.traceId}`,
            86400, // 24 hours retention
            JSON.stringify({
                ...event,
                timestamp: now.toISOString()
            })
        ]);

        // 2. Update Analytics Time-Series (Day & Hour resolution)
        // Keys: stats:{metric}:{resolution}:{key}
        // Metric: hits, misses, tokens, cost
        const typeKey = event.type === 'hit' ? 'hits' : 'misses';

        // Global Stats
        pipeline.push(['INCR', `stats:${typeKey}:d:${dateKey}`]);
        pipeline.push(['INCR', `stats:${typeKey}:h:${hourKey}`]);

        pipeline.push(['INCRBY', `stats:tokens:d:${dateKey}`, event.tokens.total]);
        pipeline.push(['INCRBYFLOAT', `stats:cost:d:${dateKey}`, event.cost]);

        // Namespace/Model Stats (Optional - keeping it simple for now)

        // 3. Update User Usage (Billing)
        pipeline.push(['INCR', `usage:${event.userId}/requests`]);
        if (event.type === 'hit') pipeline.push(['INCR', `usage:${event.userId}/hits`]);
        if (event.type === 'miss') pipeline.push(['INCR', `usage:${event.userId}/misses`]);

        // 4. Add to Recent Traces list (for Live Feed polling)
        pipeline.push(['LPUSH', `traces:recent`, JSON.stringify({
            id: event.traceId,
            type: event.type,
            model: event.model,
            latency: event.latencyMs,
            timestamp: now.toISOString(),
            cost: event.cost,
            savings: event.type === 'hit' ? event.cost : 0 // Rough estimate, actual savings calc is complex
        })]);
        pipeline.push(['LTRIM', `traces:recent`, 0, 99]); // Keep last 100

        // Execute
        await redisPipeline(pipeline);
    }
}
