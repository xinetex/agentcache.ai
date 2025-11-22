export const config = { runtime: 'edge' };

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'POST, OPTIONS',
            'access-control-allow-headers': 'Content-Type, Authorization, X-API-Key, X-Cache-Namespace',
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

async function stableKey({ tool, args, namespace = null }) {
    const data = { tool, args };
    const text = JSON.stringify(data);
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    const hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    const ns = namespace ? `${namespace}:` : '';
    return `agentcache:tool:${ns}${tool}:${hex}`;
}

async function auth(req) {
    const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '');
    if (!apiKey || !apiKey.startsWith('ac_')) return { ok: false };
    // For MVP, we accept any ac_ key. In production, verify against DB.
    return { ok: true, kind: 'live' };
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') {
        return json({ ok: true });
    }

    try {
        const authn = await auth(req);
        if (!authn.ok) return json({ error: 'Invalid API key' }, 401);

        const namespace = req.headers.get('x-cache-namespace') || null;
        const body = await req.json();
        const { tool, args, result, ttl = 60 * 60 * 24 } = body || {}; // Default 24h TTL

        if (!tool || !args) return json({ error: 'tool and args required' }, 400);

        const cacheKey = await stableKey({ tool, args, namespace });

        // SET
        if (req.url.endsWith('/set')) {
            if (result === undefined) return json({ error: 'result required' }, 400);

            await redis('SETEX', cacheKey, ttl, JSON.stringify(result));

            // Track stats
            const today = new Date().toISOString().slice(0, 10);
            redis('INCR', `stats:tool:sets:d:${today}`).catch(() => { });

            return json({ success: true, key: cacheKey, ttl });
        }

        // GET
        if (req.url.endsWith('/get')) {
            const cached = await redis('GET', cacheKey);

            if (cached) {
                const today = new Date().toISOString().slice(0, 10);
                redis('INCR', `stats:tool:hits:d:${today}`).catch(() => { });

                return json({ hit: true, result: JSON.parse(cached) });
            }

            return json({ hit: false }, 404);
        }

        return json({ error: 'Not found' }, 404);

    } catch (err) {
        return json({ error: 'Unexpected error', details: err?.message }, 500);
    }
}
