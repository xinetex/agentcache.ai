export const config = { runtime: 'edge' };

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
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    try {
        const body = await req.json();
        const { text, apiKey } = body;

        if (!text) return json({ error: 'Text required' }, 400);

        const start = Date.now();

        // 1. Redaction Logic (Regex)
        let redacted = text;

        // Email
        redacted = redacted.replace(/\b[\w\.-]+@[\w\.-]+\.\w{2,4}\b/g, '[REDACTED: EMAIL]');

        // SSN (Simple)
        redacted = redacted.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED: SSN]');

        // Phone (Simple US)
        redacted = redacted.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[REDACTED: PHONE]');

        // Date (Simple)
        redacted = redacted.replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, '[REDACTED: DATE]');

        // Names (Heuristic: Capitalized words that are not at start of sentence? Too risky for demo regex. 
        // Let's stick to high-confidence patterns for now, or simple "Dr. X" patterns)
        redacted = redacted.replace(/\bDr\.\s+[A-Z][a-z]+\b/g, '[REDACTED: DOCTOR]');
        redacted = redacted.replace(/\bPatient\s+[A-Z][a-z]+\b/g, '[REDACTED: PATIENT]');

        const latency = Date.now() - start;

        // 2. Auth & Logging
        let userHash = null;
        if (apiKey) {
            const enc = new TextEncoder();
            const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(apiKey));
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            userHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
        } else {
            // Demo Key Hash
            const demoKey = 'ac_live_demo_key_12345';
            const enc = new TextEncoder();
            const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(demoKey));
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            userHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
        }

        // Log ONLY the redacted version
        const logEntry = {
            timestamp: new Date().toISOString(),
            module: 'PII Redaction (Medical)',
            input: '[REDACTED INPUT]', // Don't even log the input if it had PII
            output: redacted.substring(0, 50) + (redacted.length > 50 ? '...' : ''),
            latency,
            cached: false,
            status: 'success'
        };

        if (userHash) {
            redis('LPUSH', `history:${userHash}`, JSON.stringify(logEntry)).catch(() => { });
            redis('LTRIM', `history:${userHash}`, 0, 99).catch(() => { });
        }

        return json({
            redacted,
            latency,
            cached: false
        });

    } catch (err) {
        return json({ error: 'Unexpected error', details: err?.message }, 500);
    }
}
