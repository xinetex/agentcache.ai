import { triggerWebhook } from './webhook-trigger.js';

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

async function stableKey(prompt, constraint) {
    const data = { prompt, constraint };
    const text = JSON.stringify(data);
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    const hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    return `agentcache:constraint:${hex}`;
}

async function callMoonshot(prompt) {
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
                { role: 'system', content: 'You are a helpful assistant. Answer the user request.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7
        })
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Moonshot API error: ${err}`);
    }

    const data = await res.json();
    return data.choices[0].message.content.trim();
}

function checkConstraint(text, constraint) {
    if (constraint === 'no_em_dash') {
        // Check for em-dash (—)
        if (text.includes('—')) {
            return {
                violated: true,
                reason: 'Detected em-dash (—)',
                fix: (t) => t.replace(/—/g, ';') // Replace with semicolon for demo
            };
        }
    }
    return { violated: false };
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') return json({ ok: true });

    try {
        const body = await req.json();
        const { prompt, constraint } = body || {};

        if (!prompt) return json({ error: 'prompt required' }, 400);
        if (!constraint) return json({ error: 'constraint required' }, 400);

        const start = Date.now();
        const cacheKey = await stableKey(prompt, constraint);

        // 1. Check Cache
        const cached = await redis('GET', cacheKey);
        if (cached) {
            const latency = Date.now() - start;
            const data = JSON.parse(cached);

            // Track stats
            const today = new Date().toISOString().slice(0, 10);
            redis('INCR', `stats:constraint:hits:d:${today}`).catch(() => { });

            return json({
                ...data,
                cached: true,
                latency
            });
        }

        // 2. Call LLM (Miss)
        let output = await callMoonshot(prompt);
        const rawOutput = output;

        // 3. Verify & Enforce
        const check = checkConstraint(output, constraint);
        const violationLog = [];

        if (check.violated) {
            violationLog.push({
                type: 'Constraint Violation',
                details: check.reason,
                action: 'Auto-Corrected'
            });
            // Apply fix
            output = check.fix(output);
        }

        const result = {
            output,
            rawOutput,
            violationLog
        };

        const latency = Date.now() - start;

        // 4. Cache Result (TTL 7 days)
        await redis('SETEX', cacheKey, 60 * 60 * 24 * 7, JSON.stringify(result));

        // Track stats
        const today = new Date().toISOString().slice(0, 10);
        redis('INCR', `stats:constraint:misses:d:${today}`).catch(() => { });

        // Log History
        const logEntry = {
            timestamp: new Date().toISOString(),
            module: 'Constraint Protocol',
            input: prompt.substring(0, 50) + (prompt.length > 50 ? '...' : ''),
            output: output.substring(0, 50) + (output.length > 50 ? '...' : ''),
            latency,
            cached: false,
            status: check.violated ? 'corrected' : 'success'
        };

        // Demo Key Hash (Hardcoded for demo consistency)
        const demoKey = 'ac_live_demo_key_12345';
        const enc = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(demoKey));
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const demoHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);

        redis('LPUSH', `history:${demoHash}`, JSON.stringify(logEntry)).catch(() => { });
        redis('LTRIM', `history:${demoHash}`, 0, 99).catch(() => { });

        // Trigger Webhook if Violated
        if (check.violated) {
            // Fire and forget
            triggerWebhook(demoHash, 'constraint_violation', {
                constraint: constraintType,
                input: prompt,
                correction: output,
                violation_details: check.details
            }).catch(err => console.error('Webhook error:', err));
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
