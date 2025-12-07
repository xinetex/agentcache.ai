
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

        return new Response(JSON.stringify({
            requests: total,
            hits,
            misses,
            hitRate: Math.round(hitRate),
            tokensSaved: tokens,
            costSaved: cost,
            latency: 45 // TODO: Calculate avg from recent signals if needed
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
