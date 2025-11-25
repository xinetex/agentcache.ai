export const config = { runtime: 'nodejs' };

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

export default async function handler(req) {
    if (req.method === 'OPTIONS') return json({ ok: true });

    try {
        const body = await req.json();
        const { apiKey } = body || {};

        if (!apiKey) return json({ error: 'API Key required' }, 400);

        // 1. Hash the API Key
        const enc = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(apiKey));
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);

        // 2. Check Redis for Email Mapping
        const email = await redis('GET', `key:${hash}:email`); // Note: webhook.js uses hset key:{hash}/email but let's check standard key structure or fix webhook
        // Wait, webhook.js used: fetch(`${UPSTASH_URL}/hset/key:${hash}/email`, ... body: JSON.stringify(customerEmail))
        // That looks like a mistake in webhook.js? "hset" expects a field and value.
        // Let's check webhook.js again.
        // Line 103: fetch(`${UPSTASH_URL}/hset/key:${hash}/email`, ...
        // This is actually invalid Redis REST usage if it's trying to set a simple key-value. It should be SET.
        // Or if it is HSET, it needs a field.
        // Let's assume for now we are fixing this or adapting to it.
        // Actually, let's look at how we can verify this.
        // If webhook.js did `hset key:{hash} email value`, that would be HSET.
        // But the URL path was `/hset/key:${hash}/email`. In Upstash REST: /hset/key/field/value.
        // So the key is `key:${hash}`, field is `email`, value is the body.
        // So we should HGET key:${hash} email.

        const storedEmail = await redis('HGET', `key:${hash}`, 'email');

        if (storedEmail) {
            // Valid Key
            // Fetch Quota
            const quota = await redis('GET', `usage:${hash}:monthlyQuota`) || 1000;

            return json({
                valid: true,
                email: storedEmail,
                plan: 'pro', // Simplified for demo, ideally fetch from metadata
                quota: parseInt(quota)
            });
        } else {
            // Invalid Key
            // For demo purposes, allow a specific "demo" key
            if (apiKey === 'ac_live_demo_key_12345') {
                return json({ valid: true, email: 'demo@agentcache.ai', plan: 'starter', quota: 5000 });
            }

            return json({ valid: false, error: 'Invalid API Key' }, 401);
        }

    } catch (err) {
        return json({ error: 'Unexpected error', details: err?.message }, 500);
    }
}
