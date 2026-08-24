import { Redis } from '@upstash/redis';
import { neon } from '@neondatabase/serverless';
import { validateApiKey, validateNamespaceAccess, recordUsage } from '../../lib/api-key-middleware.js';
import { recordHit, hitEventFromHeaders } from '../../lib/savings-recorder.js';

export const config = {
    runtime: 'nodejs',
};

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Ledger writer for the Savings Engine (Move 1). Separate from the Redis cache
// store; used only to append priced hit rows for auditable net-dollars-saved.
import { ensureSavingsSchema } from '../../lib/ensure-schema.js';
const sql = neon(process.env.DATABASE_URL!);
ensureSavingsSchema(sql).catch(() => {}); // self-provision on cold start

export default async function handler(req: Request) {
    if (req.method !== 'GET') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    }

    try {
        // Extract API key from Authorization header
        const authHeader = req.headers.get('Authorization') || req.headers.get('X-API-Key');
        const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
        
        if (!apiKey || !apiKey.startsWith('ac_')) {
            return new Response(JSON.stringify({ 
                error: 'Unauthorized',
                message: 'Valid AgentCache API key required (ac_live_* or ac_test_*)'
            }), { status: 401 });
        }

        // Validate API key and get organization context
        let keyContext;
        try {
            keyContext = await validateApiKey(apiKey);
        } catch (error: any) {
            return new Response(JSON.stringify({ 
                error: 'Unauthorized',
                message: error.message 
            }), { status: 401 });
        }

        // Get namespace from header (required for multi-tenant)
        const namespace = req.headers.get('X-Cache-Namespace');
        
        if (!namespace) {
            return new Response(JSON.stringify({ 
                error: 'Bad Request',
                message: 'X-Cache-Namespace header required'
            }), { status: 400 });
        }

        // Validate namespace access
        try {
            validateNamespaceAccess(keyContext, namespace);
        } catch (error: any) {
            return new Response(JSON.stringify({ 
                error: 'Forbidden',
                message: error.message 
            }), { status: 403 });
        }

        // Extract key from URL
        const url = new URL(req.url);
        const userKey = url.searchParams.get('key');

        if (!userKey) {
            return new Response(JSON.stringify({ 
                error: 'Bad Request',
                message: 'key parameter required' 
            }), { status: 400 });
        }

        // Namespace-prefix the key for multi-tenant isolation
        // Format: org_slug:namespace:user_key
        const prefixedKey = `${keyContext.organizationSlug}:${namespace}:${userKey}`;

        // Get from Redis
        const value = await redis.get(prefixedKey);

        const isHit = value !== null;

        // Record usage metrics (async, non-blocking)
        recordUsage(keyContext.organizationId, namespace, {
            requests: 1,
            hits: isHit ? 1 : 0,
            misses: isHit ? 0 : 1
        }).catch(err => console.error('Failed to record usage:', err));

        // Move 1: on a hit, append a priced row to the savings ledger
        // (layer/model/tokens/$). Ledger-only — the daily aggregate is already
        // handled by recordUsage above, so there is no double counting. The
        // caller declares model + token counts via X-Model / X-Input-Tokens /
        // X-Output-Tokens; absent them the hit is still logged, valued at $0.
        if (isHit) {
            recordHit({ sql }, {
                organizationId: keyContext.organizationId,
                namespace,
                event: hitEventFromHeaders(req.headers, 'exact'),
            }).catch((err: any) => console.error('Failed to record savings hit:', err));
        }

        if (value === null) {
            // A cache miss is a normal, expected outcome — NOT an HTTP error.
            // The documented SDK checks `cached.hit`, so return 200 with hit:false.
            return new Response(JSON.stringify({
                hit: false,
                cached: false,
                value: null,
                namespace,
                organizationSlug: keyContext.organizationSlug
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Cache-Status': 'MISS',
                    'X-Cache-Namespace': namespace
                }
            });
        }

        return new Response(JSON.stringify({
            hit: true,
            value,
            namespace,
            organizationSlug: keyContext.organizationSlug,
            cached: true
        }), {
            headers: {
                'Content-Type': 'application/json',
                'X-Cache-Status': 'HIT',
                'X-Cache-Namespace': namespace
            }
        });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
