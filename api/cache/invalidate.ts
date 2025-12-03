import { antiCache } from '../../src/mcp/anticache';

// Initialize invalidator
const cacheInvalidator = new antiCache.CacheInvalidator();

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-API-Key'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { pattern, namespace, olderThan, url, reason, notify, preWarm } = req.body;

        // Validate at least one invalidation criterion
        if (!pattern && !namespace && !olderThan && !url) {
            return res.status(400).json({
                error: 'Must provide at least one invalidation criterion',
                criteria: ['pattern', 'namespace', 'olderThan', 'url']
            });
        }

        // Perform invalidation
        const result = await cacheInvalidator.invalidate({
            pattern,
            namespace,
            olderThan,
            url,
            reason,
            notify,
            preWarm
        });

        return res.status(200).json({
            success: true,
            ...result,
            reason: reason || 'manual_invalidation',
            timestamp: Date.now()
        });

    } catch (error) {
        console.error('[Anti-Cache] Invalidation error:', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
