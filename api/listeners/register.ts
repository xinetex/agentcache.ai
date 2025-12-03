import { antiCache } from '../../src/mcp/anticache';

// Initialize monitor
const urlMonitor = new antiCache.UrlMonitor();

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-API-Key'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        // POST: Register Listener
        if (req.method === 'POST') {
            const { url, checkInterval = 900000, namespace = 'default', invalidateOnChange = true, webhook } = req.body;

            if (!url) {
                return res.status(400).json({ error: 'URL is required' });
            }

            // Validate URL
            try {
                new URL(url);
            } catch {
                return res.status(400).json({ error: 'Invalid URL format' });
            }

            // Minimum interval: 15 minutes (900000ms)
            if (checkInterval < 900000) {
                return res.status(400).json({ error: 'Check interval must be at least 15 minutes (900000ms)' });
            }

            // Register listener
            const listenerId = await urlMonitor.registerListener({
                url,
                checkInterval,
                namespace,
                invalidateOnChange,
                webhook,
                enabled: true
            });

            const listener = await urlMonitor.getListener(listenerId);

            return res.status(201).json({
                success: true,
                listenerId,
                url,
                checkInterval,
                namespace,
                initialHash: listener?.lastHash || '',
                message: 'Listener registered successfully. First check will run in background.'
            });
        }

        // GET: List Listeners
        if (req.method === 'GET') {
            const listeners = await urlMonitor.getAllListeners();

            return res.status(200).json({
                listeners: listeners.map(l => ({
                    id: l.id,
                    url: l.url,
                    checkInterval: l.checkInterval,
                    lastCheck: l.lastCheck,
                    lastHash: l.lastHash.substring(0, 8),
                    namespace: l.namespace,
                    invalidateOnChange: l.invalidateOnChange,
                    webhook: l.webhook,
                    enabled: l.enabled
                })),
                count: listeners.length
            });
        }

        // DELETE: Unregister Listener
        if (req.method === 'DELETE') {
            const { id } = req.query;

            if (!id) {
                return res.status(400).json({ error: 'Listener ID is required' });
            }

            const success = await urlMonitor.unregisterListener(id as string);

            if (!success) {
                return res.status(404).json({ error: 'Listener not found' });
            }

            return res.status(200).json({
                success: true,
                message: 'Listener unregistered successfully'
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('[Anti-Cache] Listener API error:', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
