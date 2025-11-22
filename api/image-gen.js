export const config = { runtime: 'edge' };

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'POST, OPTIONS',
            'access-control-allow-headers': 'Content-Type, Authorization',
        },
    });
}

const getEnv = () => ({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function redis(command, ...args) {
    const { url, token } = getEnv();
    if (!url || !token) throw new Error('Upstash not configured');
    const path = `${command}/${args.map(encodeURIComponent).join('/')}`;
    const res = await fetch(`${url}/${path}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Upstash ${res.status}`);
    const data = await res.json();
    return data.result;
}

async function stableKey(prompt) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(prompt));
    const hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    return `agentcache:image-gen:${hex}`;
}

// Simulate the Agent Loop: Generation -> OCR -> Retry
async function simulateAgentLoop(prompt) {
    // Simulate 1-3 failed attempts before success
    const attempts = Math.floor(Math.random() * 3) + 1;
    const delayPerAttempt = 800; // ms

    // Artificial delay
    await new Promise(resolve => setTimeout(resolve, attempts * delayPerAttempt));

    return {
        attempts,
        seed: Math.floor(Math.random() * 1000000),
        cost: attempts * 0.04 // $0.04 per image gen
    };
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') return json({ ok: true });

    try {
        const body = await req.json();
        const { prompt } = body || {};

        if (!prompt) return json({ error: 'prompt required' }, 400);

        const start = Date.now();
        const cacheKey = await stableKey(prompt);

        // 1. Check Cache
        const cached = await redis('GET', cacheKey);
        if (cached) {
            const latency = Date.now() - start;
            const data = JSON.parse(cached);

            // Track stats
            const today = new Date().toISOString().slice(0, 10);
            redis('INCR', `stats:image:hits:d:${today}`).catch(() => { });

            return json({
                result: data,
                cached: true,
                latency,
                savings: data.cost // We saved the generation cost
            });
        }

        // 2. Run Agent Loop (Miss)
        const result = await simulateAgentLoop(prompt);
        const latency = Date.now() - start;

        // 3. Cache Result (TTL 7 days)
        await redis('SETEX', cacheKey, 60 * 60 * 24 * 7, JSON.stringify(result));

        // Track stats
        const today = new Date().toISOString().slice(0, 10);
        redis('INCR', `stats:image:misses:d:${today}`).catch(() => { });

        return json({
            result,
            cached: false,
            latency,
            savings: 0
        });

    } catch (err) {
        return json({ error: 'Unexpected error', details: err?.message }, 500);
    }
}
