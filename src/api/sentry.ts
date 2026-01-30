
import { Hono } from 'hono';
import { SentryAgent } from '../services/sentry-agent.js';

const sentryRouter = new Hono();

// Todo: Load these from DB or Config in production
let monitoredIPs: string[] = [];

/**
 * POST /api/sentry/configure
 * Update the list of monitored IPs
 */
sentryRouter.post('/configure', async (c) => {
    try {
        const body = await c.req.json();
        const { ips } = body;

        if (!Array.isArray(ips)) {
            return c.json({ error: 'ips must be an array of strings' }, 400);
        }

        monitoredIPs = ips; // In-memory for now, would persist to DB
        return c.json({ success: true, count: monitoredIPs.length, monitoredIPs });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * POST /api/sentry/check
 * Trigger a manual check of all monitored IPs
 */
sentryRouter.post('/check', async (c) => {
    try {
        // Allow passing IPs directly for one-off checks
        const body = await c.req.json().catch(() => ({}));
        const targetIPs = body.ips || monitoredIPs;

        if (targetIPs.length === 0) {
            return c.json({
                error: 'No IPs configured. POST to /configure first or provide "ips" in body.'
            }, 400);
        }

        const agent = new SentryAgent(targetIPs);
        const alerts = await agent.checkExposure();

        // Log Critical/High alerts to system log (or notify user)
        const criticalAlerts = alerts.filter(a => ['CRITICAL', 'HIGH'].includes(a.level));
        if (criticalAlerts.length > 0) {
            console.error('[SENTRY ALERT] Critical exposures detected:', JSON.stringify(criticalAlerts, null, 2));
        }

        return c.json({
            success: true,
            timestamp: new Date().toISOString(),
            targetsChecked: targetIPs.length,
            alerts: alerts,
            status: criticalAlerts.length > 0 ? 'RISK_DETECTED' : 'SECURE'
        });

    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

export default sentryRouter;
