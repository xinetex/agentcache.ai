export const config = { runtime: 'nodejs' };

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
        const url = new URL(req.url);
        const apiKey = url.searchParams.get('apiKey');

        if (!apiKey) return json({ error: 'API Key required' }, 400);

        // 1. Hash the API Key
        const enc = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(apiKey));
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const userHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);

        // 2. Fetch History
        // We store history as a list of JSON strings in `history:{hash}`
        const history = (await redis('LRANGE', `history:${userHash}`, '0', '49'))
            .map(item => {
                try {
                    const parsed = JSON.parse(item);
                    // Enrich with Energy Metrics if not present
                    if (!parsed.joules_saved) {
                        // Estimate: 0.04J per token, assume ~100 tokens per op if cached
                        parsed.joules_saved = parsed.cached ? 4.0 : 0;
                    }
                    return parsed;
                } catch (e) { return null; }
            })
            .filter(Boolean);

        return json({ logs: history });

    } catch (err) {
        return json({ error: 'Unexpected error', details: err?.message }, 500);
    }
}
