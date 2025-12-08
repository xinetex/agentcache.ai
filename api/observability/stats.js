
export const config = { runtime: 'nodejs' };

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(command, ...args) {
    const path = `${command}/${args.map(a => encodeURIComponent(String(a))).join('/')}`;
    const res = await fetch(`${UPSTASH_URL}/${path}`, {
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    });
    const data = await res.json();
    return data.result;
}

export default async function handler(req) {
    // Auth Check (Basic for now, assume Middleware handles or check header)
    // const token = req.headers.get('Authorization');
    // if(!token) return new Response('Unauthorized', { status: 401 });

    const now = new Date();
    const dateKey = now.toISOString().split('T')[0]; // YYYY-MM-DD

    try {
        // Fetch Today's Stats in parallel
        // stats:{type}:d:{date}
        // types: hits, misses, tokens, cost
        const pipeline = [
            ['GET', `stats:hits:d:${dateKey}`],
            ['GET', `stats:misses:d:${dateKey}`],
            ['GET', `stats:tokens:d:${dateKey}`],
            ['GET', `stats:cost:d:${dateKey}`],
        ];

        const res = await fetch(`${UPSTASH_URL}/pipeline`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
            body: JSON.stringify(pipeline)
        });
        const results = await res.json();

        const hits = Number(results[0].result || 0);
        const misses = Number(results[1].result || 0);
        const tokens = Number(results[2].result || 0);
        const cost = Number(results[3].result || 0);

        const total = hits + misses;
        const hitRate = total > 0 ? (hits / total) * 100 : 0;

        // Fetch recent traces for advanced latency analysis (P50/P95)
        const tracesRes = await fetch(`${UPSTASH_URL}/lrange/traces:recent/0/99`, {
            headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
        });
        const traceData = await tracesRes.json();
        const validLatencies = (traceData.result || [])
            .map(s => { try { return JSON.parse(s).latency; } catch (e) { return 0; } })
            .filter(l => l > 0)
            .sort((a, b) => a - b);

        const p50 = validLatencies.length ? validLatencies[Math.floor(validLatencies.length * 0.5)] : 0;
        const p95 = validLatencies.length ? validLatencies[Math.floor(validLatencies.length * 0.95)] : 0;

        return new Response(JSON.stringify({
            requests: total,
            hits,
            misses,
            hitRate: Math.round(hitRate),
            tokensSaved: tokens,
            costSaved: cost,
            latency: {
                avg: p50, // fast approximation
                p50,
                p95
            }
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
