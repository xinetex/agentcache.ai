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
    moonshotKey: process.env.MOONSHOT_API_KEY,
    moonshotUrl: process.env.MOONSHOT_ENDPOINT || 'https://api.moonshot.ai/v1/chat/completions'
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

async function stableKey(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    const hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    return `agentcache:spelling:${hex}`;
}

async function callMoonshot(text) {
    const { moonshotKey, moonshotUrl } = getEnv();
    const res = await fetch(moonshotUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${moonshotKey}`
        },
        body: JSON.stringify({
            model: 'moonshot-v1-8k',
            messages: [
                { role: 'system', content: 'You are a spell checker. Fix the spelling and grammar of the user input. Output ONLY the fixed text. Do not add any explanations or quotes.' },
                { role: 'user', content: text }
            ],
            temperature: 0.1
        })
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Moonshot API error: ${err}`);
    }

    const data = await res.json();
    return data.choices[0].message.content.trim();
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') return json({ ok: true });

    try {
        const body = await req.json();
        const { text } = body || {};

        if (!text) return json({ error: 'text required' }, 400);
        if (text.length > 1000) return json({ error: 'text too long' }, 400);

        const start = Date.now();
        const cacheKey = await stableKey(text);

        // 1. Check Cache
        const cached = await redis('GET', cacheKey);
        if (cached) {
            const latency = Date.now() - start;
            // Track stats
            const today = new Date().toISOString().slice(0, 10);
            redis('INCR', `stats:spelling:hits:d:${today}`).catch(() => { });

            return json({
                fixed: cached,
                cached: true,
                latency
            });
        }

        // 2. Call LLM (Miss)
        const fixed = await callMoonshot(text);
        const latency = Date.now() - start;

        // 3. Cache Result (TTL 7 days)
        await redis('SETEX', cacheKey, 60 * 60 * 24 * 7, fixed);

        // Track stats
        const today = new Date().toISOString().slice(0, 10);
        redis('INCR', `stats:spelling:misses:d:${today}`).catch(() => { });

        return json({
            fixed,
            cached: false,
            latency
        });

    } catch (err) {
        return json({ error: 'Unexpected error', details: err?.message }, 500);
    }
}
