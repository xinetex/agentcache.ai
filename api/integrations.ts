export const config = { runtime: 'edge' };

function json(data: any, status: number = 200): Response {
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

async function redis(command: string, ...args: string[]): Promise<any> {
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

export default async function handler(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') return json({ ok: true });

    try {
        // Auth Check (Simplified: Expect apiKey in body or query)
        let apiKey: string | null = null;
        let body: { apiKey?: string; webhookUrl?: string } = {};

        if (req.method === 'POST') {
            body = await req.json();
            apiKey = body.apiKey || null;
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

        if (req.method === 'POST') {
            // Save Webhook URL
            const { webhookUrl } = body;
            if (!webhookUrl) return json({ error: 'Webhook URL required' }, 400);

            await redis('HSET', `user:${hash}`, 'webhookUrl', webhookUrl);
            return json({ success: true, webhookUrl });
        }

        if (req.method === 'GET') {
            // Get Webhook URL
            const webhookUrl = await redis('HGET', `user:${hash}`, 'webhookUrl');
            return json({ webhookUrl: webhookUrl || '' });
        }

        return json({ error: 'Method not allowed' }, 405);

    } catch (err) {
        return json({ error: 'Unexpected error', details: err?.message }, 500);
    }
}
