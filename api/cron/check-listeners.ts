export const config = {
    runtime: 'nodejs',
};

/**
 * Vercel Cron Handler: Check URL listeners for content changes
 * Schedule: every 15 minutes (configured in vercel.json)
 *
 * Iterates all registered URL listeners, checks for content changes,
 * and triggers cache invalidation when changes are detected.
 */
export default async function handler(req: Request) {
    // Verify Cron Secret to prevent unauthorized triggers
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', { status: 401 });
    }

    if (process.env.ENABLE_LISTENER_MONITOR !== '1') {
        return new Response(JSON.stringify({
            success: true,
            checked: 0,
            invalidated: 0,
            errors: 0,
            skipped: true,
            reason: 'Listener monitor disabled',
            timestamp: Date.now(),
        }), {
            headers: { 'content-type': 'application/json' }
        });
    }

    try {
        const { UrlMonitor } = await import('../../src/mcp/anticache.js');
        const monitor = new UrlMonitor();
        const listeners = await monitor.getAllListeners();

        let checked = 0;
        let invalidated = 0;
        let errors = 0;

        for (const listener of listeners) {
            if (!listener.enabled) continue;

            try {
                const result = await monitor.checkListener(listener.id);
                checked++;
                if (result?.changed) {
                    invalidated++;
                }
            } catch (err: any) {
                console.error(`[CheckListeners] Error checking ${listener.url}:`, err.message);
                errors++;
            }
        }

        return new Response(JSON.stringify({
            success: true,
            checked,
            invalidated,
            errors,
            timestamp: Date.now()
        }), {
            headers: { 'content-type': 'application/json' }
        });
    } catch (err: any) {
        console.error('[CheckListeners] Cron job failed:', err);
        return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500,
            headers: { 'content-type': 'application/json' }
        });
    }
}
