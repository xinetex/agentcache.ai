import { Redis } from '@upstash/redis';
import { validateApiKey, validateNamespaceAccess, recordUsage } from '../../lib/api-key-middleware.js';

export const config = {
    runtime: 'nodejs',
};

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export default async function handler(req: Request) {
    if (req.method !== 'POST') {
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

        const { key, value, ttl } = await req.json();

        if (!key || value === undefined) {
            return new Response(JSON.stringify({ 
                error: 'Bad Request',
                message: 'key and value required in request body' 
            }), { status: 400 });
        }

        // Namespace-prefix the key for multi-tenant isolation
        // Format: org_slug:namespace:user_key
        const prefixedKey = `${keyContext.organizationSlug}:${namespace}:${key}`;

        // Store in Redis
        if (ttl) {
            await redis.set(prefixedKey, value, { ex: ttl });
        } else {
            await redis.set(prefixedKey, value);
        }

        // Record usage metrics (async, non-blocking)
        recordUsage(keyContext.organizationId, namespace, {
            requests: 1,
            hits: 0,
            misses: 0
        }).catch(err => console.error('Failed to record usage:', err));

        return new Response(JSON.stringify({ 
            success: true,
            key,
            namespace,
            organizationSlug: keyContext.organizationSlug,
            ttl: ttl || null
        }), {
            headers: { 
                'Content-Type': 'application/json',
                'X-Cache-Namespace': namespace
            }
        });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
