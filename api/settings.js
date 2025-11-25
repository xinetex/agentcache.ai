export const config = { runtime: 'nodejs' };

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'GET, POST, OPTIONS',
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
        // Auth Check
        let apiKey;
        let body = {};

        if (req.method === 'POST') {
            body = await req.json();
            apiKey = body.apiKey;
        } else {
            const url = new URL(req.url);
            apiKey = url.searchParams.get('apiKey');
        }

        if (!apiKey) return json({ error: 'API Key required' }, 400);

        // Hash API Key
        const enc = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(apiKey));
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);

        const settingsKey = `user:${hash}:settings`;

        if (req.method === 'POST') {
            // Save Settings
            const { settings } = body;
            if (!settings) return json({ error: 'Settings required' }, 400);

            await redis('SET', settingsKey, JSON.stringify(settings));
            return json({ success: true, settings });
        }

        if (req.method === 'GET') {
            // Get Settings
            const settingsStr = await redis('GET', settingsKey);
            const settings = settingsStr ? JSON.parse(settingsStr) : {
                semantic_correction: true,
                cognitive_sentinel: true,
                constraint_enforcement: true
            }; // Default to all ON
            return json({ settings });
        }

        return json({ error: 'Method not allowed' }, 405);

    } catch (err) {
        return json({ error: 'Unexpected error', details: err?.message }, 500);
    }
}
