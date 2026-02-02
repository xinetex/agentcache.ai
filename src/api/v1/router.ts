import { Hono } from 'hono';
import { authenticateApiKey } from '../../middleware/auth.js';
import { TrustBrokerService } from '../../services/trust-broker.js';
import { billing } from '../../lib/payment/billing.js';

type Variables = {
    tier: string;
    usage: any;
    tierFeatures: any;
    apiKey: string;
};

const v1 = new Hono<{ Variables: Variables }>();

// Initialize Services
const broker = new TrustBrokerService();

// Apply Auth Middleware to all /v1 routes
v1.use('*', authenticateApiKey);

/**
 * POST /v1/truth/verify
 * Public endpoint for agents to verify claims.
 * Cost: 10 Credits per call.
 */
v1.post('/truth/verify', async (c) => {
    const body = await c.req.json();
    const { claim } = body;

    if (!claim || typeof claim !== 'string') {
        return c.json({ error: 'Missing or invalid "claim" field' }, 400);
    }

    // Metering (Mock Subscription Item ID for now)
    // In production, we'd lookup the user's subscription item ID from DB
    await billing.recordUsage('si_mock_metered_usage', 10);

    try {
        const result = await broker.verifyClaim(claim);

        return c.json({
            meta: {
                credits_deducted: 10,
                model: 'system-2-reasoner'
            },
            data: result
        });

    } catch (e) {
        console.error('[API v1] Verify failed:', e);
        return c.json({ error: 'Internal verification error' }, 500);
    }
});

/**
 * GET /v1/status
 * Check API health and auth status
 */
v1.get('/status', (c) => {
    const tier = c.get('tier');
    const usage = c.get('usage');
    return c.json({
        system: 'online',
        auth: {
            tier,
            quota_remaining: usage?.remaining
        }
    });
});

import { docsRouter } from './docs.js';
v1.route('/docs', docsRouter);

export const v1Router = v1;
