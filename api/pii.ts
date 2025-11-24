import { redactPII } from '../src/lib/pii/redactor';

export const config = {
    runtime: 'edge',
};

interface PiiRequest {
    text: string;
    apiKey?: string;
}

interface PiiResponse {
    redacted?: string;
    findings?: string[];
    riskScore?: number;
    latency?: number;
    cached?: boolean;
    error?: string;
    details?: string;
}

function json(data: PiiResponse, status = 200) {
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

async function logToHistory(apiKey: string | undefined, entry: any) {
    if (!apiKey) return; // Don't log if no key (or handle demo key logic)

    try {
        const enc = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(apiKey));
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const userHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);

        const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
        const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

        if (UPSTASH_URL && UPSTASH_TOKEN) {
            await fetch(`${UPSTASH_URL}/lpush/history:${userHash}/${encodeURIComponent(JSON.stringify(entry))}`, {
                headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
            });
            // Trim to last 100
            await fetch(`${UPSTASH_URL}/ltrim/history:${userHash}/0/99`, {
                headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
            });
        }
    } catch (e) {
        console.error('Logging failed', e);
    }
}

export default async function handler(req: Request) {
    if (req.method === 'OPTIONS') {
        return json({}, 204);
    }

    if (req.method !== 'POST') {
        return json({ error: 'Method not allowed' }, 405);
    }

    try {
        const body = await req.json() as PiiRequest;
        const { text, apiKey } = body;

        if (!text) {
            return json({ error: 'Text required' }, 400);
        }

        const start = Date.now();

        // 1. Redact
        const result = redactPII(text);

        const latency = Date.now() - start;

        // 2. Log (Async)
        const logEntry = {
            timestamp: new Date().toISOString(),
            module: 'PII Redaction (Medical)',
            input: '[REDACTED INPUT]', // Never log raw input
            output: result.redacted.substring(0, 50) + (result.redacted.length > 50 ? '...' : ''),
            findings: result.findings,
            riskScore: result.riskScore,
            latency,
            cached: false,
            status: 'success'
        };

        // Fire and forget logging
        logToHistory(apiKey || 'ac_demo_default', logEntry);

        return json({
            redacted: result.redacted,
            findings: result.findings,
            riskScore: result.riskScore,
            latency,
            cached: false
        });

    } catch (err: any) {
        return json({ error: 'Unexpected error', details: err.message }, 500);
    }
}
