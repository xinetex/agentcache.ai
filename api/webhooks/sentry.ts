
import { LaneService } from '../../src/lib/workflow/LaneService.js';
import { SentryConnector, SentryWebhookPayload } from '../../src/connectors/sentry.js';

export const config = {
    runtime: 'nodejs',
};

const lanes = new LaneService();

/**
 * Sentry Webhook Handler
 * Configure in Sentry: Settings -> Integrations -> Webhooks
 * URL: https://agentcache-ai.vercel.app/api/webhooks/sentry
 */
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(200).send('AgentCache Sentry Sensor Active');
    }

    // Optional: Verify signature if SENTRY_WEBHOOK_SECRET is set
    const signature = req.headers['sentry-hook-signature'];
    const secret = process.env.SENTRY_WEBHOOK_SECRET;

    if (secret && signature) {
        const rawBody = JSON.stringify(req.body);
        if (!SentryConnector.verifySignature(rawBody, signature, secret)) {
            console.warn('[Sentry Webhook] Invalid signature');
            return res.status(401).json({ error: 'Invalid signature' });
        }
    }

    const payload = req.body as SentryWebhookPayload;

    // Only process new issues
    if (payload.action !== 'created') {
        return res.status(200).json({ received: true, action: payload.action, processed: false });
    }

    try {
        // Normalize the payload
        const incident = SentryConnector.normalizePayload(payload);

        // Dispatch to the queue
        const jobId = await lanes.dispatch('software-quality', 'incident_triage', incident);

        console.log(`[Sentry Webhook] Dispatched Incident Triage Job: ${jobId}`);

        return res.status(200).json({
            success: true,
            queued: true,
            jobId,
            alertId: incident.alertId,
            lane: 'software-quality'
        });

    } catch (e: any) {
        console.error('[Sentry Webhook] Error:', e);
        return res.status(500).json({ error: e.message });
    }
}
