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

        // 0. Auth & Settings Check
        let apiKey = req.headers.get('x-api-key') || body.apiKey; // Support header or body
        let userHash = null;
        let settings = { semantic_correction: true }; // Default

        if (apiKey) {
            const enc = new TextEncoder();
            const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(apiKey));
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            userHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);

            // Fetch Settings
            const settingsStr = await redis('GET', `user:${userHash}:settings`);
            if (settingsStr) {
                try { settings = JSON.parse(settingsStr); } catch (e) { }
            }
        } else {
            // Fallback to demo key for logging if no key provided
            const demoKey = 'ac_live_demo_key_12345';
            const enc = new TextEncoder();
            const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(demoKey));
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            userHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
        }

        // Check Feature Toggle
        if (settings.semantic_correction === false) {
            // Log Skipped
            const logEntry = {
                timestamp: new Date().toISOString(),
                module: 'Semantic Correction',
                input: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
                output: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
                latency: 0,
                cached: false,
                status: 'skipped_by_user'
            };
            redis('LPUSH', `history:${userHash}`, JSON.stringify(logEntry)).catch(() => { });
            redis('LTRIM', `history:${userHash}`, 0, 99).catch(() => { });

            return json({
                fixed: text,
                cached: false,
                latency: 0,
                status: 'skipped'
            });
        }

        // 1. Check Cache
        const cacheKey = `spelling:${text.trim().toLowerCase()}`;
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
        const result = { fixed }; // Define result here for consistency with the new return statement

        // 4. Cache Result (TTL 24h)
        await redis('SETEX', cacheKey, 60 * 60 * 24, fixed); // Cache the fixed string directly

        // Track stats
        const today = new Date().toISOString().slice(0, 10);
        redis('INCR', `stats:spelling:misses:d:${today}`).catch(() => { });

        // Log History (Async)
        const logEntry = {
            timestamp: new Date().toISOString(),
            module: 'Semantic Correction',
            input: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
            output: fixed.substring(0, 50) + (fixed.length > 50 ? '...' : ''),
            latency,
            cached: false,
            status: 'success'
        };

        if (userHash) {
            redis('LPUSH', `history:${userHash}`, JSON.stringify(logEntry)).catch(() => { });
            redis('LTRIM', `history:${userHash}`, 0, 99).catch(() => { });
        }

        return json({
            ...result,
            cached: false,
            latency
        });

    } catch (err) {
        return json({ error: 'Unexpected error', details: err?.message }, 500);
    }
}
