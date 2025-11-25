export const config = {
    runtime: 'nodejs',
};

interface AuditLogRequest {
    action: string;
    resourceId?: string;
    actor?: string;
    details?: any;
    status: 'success' | 'failure' | 'warning';
}

interface AuditLogResponse {
    success: boolean;
    logId?: string;
    timestamp?: string;
    error?: string;
}

function json(data: AuditLogResponse, status = 200) {
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

export default async function handler(req: Request) {
    if (req.method === 'OPTIONS') {
        return json({ success: true }, 204);
    }

    if (req.method !== 'POST') {
        return json({ success: false, error: 'Method not allowed' }, 405);
    }

    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return json({ success: false, error: 'Unauthorized' }, 401);
        }
        const apiKey = authHeader.replace('Bearer ', '');

        const body = await req.json() as AuditLogRequest;
        const { action, resourceId, actor, details, status } = body;

        if (!action || !status) {
            return json({ success: false, error: 'Missing required fields: action, status' }, 400);
        }

        const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
        const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

        if (!UPSTASH_URL || !UPSTASH_TOKEN) {
            return json({ success: false, error: 'Server configuration error' }, 500);
        }

        // Generate Log ID
        const logId = `audit:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
        const timestamp = new Date().toISOString();

        // Hash API Key for tenant isolation
        const enc = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(apiKey));
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const tenantHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);

        const logEntry = {
            id: logId,
            timestamp,
            tenant: tenantHash,
            action,
            resourceId: resourceId || 'N/A',
            actor: actor || 'system',
            status,
            details: details || {},
            ip: req.headers.get('x-forwarded-for') || 'unknown',
            userAgent: req.headers.get('user-agent') || 'unknown'
        };

        // 1. Store individual log (Immutable)
        await fetch(`${UPSTASH_URL}/set/${logId}/${encodeURIComponent(JSON.stringify(logEntry))}`, {
            headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
        });

        // 2. Add to Tenant's Audit Stream (List)
        await fetch(`${UPSTASH_URL}/lpush/audit_stream:${tenantHash}/${encodeURIComponent(logId)}`, {
            headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
        });

        return json({
            success: true,
            logId,
            timestamp
        }, 201);

    } catch (err: any) {
        return json({ success: false, error: err.message }, 500);
    }
}
