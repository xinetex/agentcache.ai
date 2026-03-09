import { Hono } from 'hono';
import { antiCache } from '../mcp/anticache.js';

const app = new Hono();

/**
 * GET /api/cron/anti-cache-tick
 * Triggered periodically by Vercel Cron.
 * Protected by Vercel's secret headers.
 */
app.get('/anti-cache-tick', async (c) => {
    // Basic Security: Ensure this is called by Vercel Cron
    const authHeader = c.req.header('Authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return c.text('Unauthorized', 401);
    }

    try {
        const urlMonitor = new antiCache.UrlMonitor();
        const listeners = await urlMonitor.getAllListeners();

        console.log(`[Cron] Executing Anti-Cache URL Check. Found ${listeners.length} active listeners.`);

        let checked = 0;
        let changed = 0;

        // Process sequentially to avoid memory spikes
        for (const listener of listeners) {
            if (listener.enabled) {
                const result = await urlMonitor.checkUrl(listener.id);
                checked++;
                if (result.changed) changed++;
            }
        }

        return c.json({
            success: true,
            stats: {
                total_listeners: listeners.length,
                checked_count: checked,
                changed_detected: changed
            }
        });
    } catch (error: any) {
        console.error('[Cron] Anti-Cache Tick Failed:', error);
        return c.json({ error: error.message }, 500);
    }
});

export default app;
