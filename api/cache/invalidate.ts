import { antiCache } from '../../src/mcp/anticache.js';
import { validateApiKey, validateNamespaceAccess } from '../../lib/api-key-middleware.js';

// Initialize invalidator
const cacheInvalidator = new antiCache.CacheInvalidator();

export default async function handler(req, res) {
    // CORS — token-authenticated JSON API. Do NOT combine `*` origin with
    // Allow-Credentials: true (invalid per spec and unsafe). This endpoint
    // authenticates via API key header, so credentialed CORS is not needed.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Content-Type, Authorization, X-API-Key, X-Cache-Namespace'
    );

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // --- Authentication (previously MISSING — anyone could flush any tenant) ---
    const authHeader = req.headers['authorization'] || req.headers['x-api-key'];
    const apiKey = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.substring(7)
        : authHeader;

    if (!apiKey || !apiKey.startsWith('ac_')) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Valid AgentCache API key required'
        });
    }

    let keyContext;
    try {
        keyContext = await validateApiKey(apiKey);
    } catch (error) {
        return res.status(401).json({ error: 'Unauthorized', message: error.message });
    }

    try {
        const { pattern, namespace, olderThan, url, reason, notify, preWarm } = req.body || {};

        // Validate at least one invalidation criterion
        if (!pattern && !namespace && !olderThan && !url) {
            return res.status(400).json({
                error: 'Must provide at least one invalidation criterion',
                criteria: ['pattern', 'namespace', 'olderThan', 'url']
            });
        }

        // --- Tenant scoping (previously MISSING — patterns/namespaces were global) ---
        // Cache entries are stored by get/set as `${orgSlug}:${namespace}:${key}`.
        // We force every invalidation to be prefixed with the caller's org slug so a
        // tenant can only ever invalidate their own keys, never another org's.
        const orgSlug = keyContext.organizationSlug;
        let scopedPattern = pattern;

        if (namespace) {
            // Ensure the caller is allowed to touch this namespace, then convert the
            // request into an org+namespace-scoped pattern against the real keyspace.
            try {
                validateNamespaceAccess(keyContext, namespace);
            } catch (error) {
                return res.status(403).json({ error: 'Forbidden', message: error.message });
            }
            scopedPattern = `${orgSlug}:${namespace}:${pattern || '*'}`;
        } else if (pattern) {
            // Bare pattern: force it under the caller's org prefix.
            scopedPattern = pattern.startsWith(`${orgSlug}:`)
                ? pattern
                : `${orgSlug}:${pattern}`;
        } else {
            // olderThan/url only — still constrain scanning to this org's keyspace.
            scopedPattern = `${orgSlug}:*`;
        }

        // Perform invalidation (namespace intentionally omitted so the scoped
        // pattern path is used against the real org-prefixed keys).
        const result = await cacheInvalidator.invalidate({
            pattern: scopedPattern,
            olderThan,
            url,
            reason,
            notify,
            preWarm
        });

        return res.status(200).json({
            success: true,
            ...result,
            organizationSlug: orgSlug,
            reason: reason || 'manual_invalidation',
            timestamp: Date.now()
        });

    } catch (error) {
        console.error('[Anti-Cache] Invalidation error:', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
