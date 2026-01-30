import { Hono } from 'hono';
import { authMiddleware } from './auth.js';
import { getAllTiers, TIERS } from '../config/tiers.js';
import Stripe from 'stripe';
import { db } from '../db/client.js';
import { users, organizations, members } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const app = new Hono<{ Variables: { user: any } }>();
// Initialize Stripe lazily
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2025-02-24.acacia' }) : null;

// --- Public Endpoints ---

/**
 * GET /plans
 * Returns comprehensive tier configuration
 */
app.get('/plans', (c) => {
    return c.json({
        tiers: getAllTiers(),
        currency: 'USD'
    });
});

// --- Protected Endpoints ---

app.use('/*', authMiddleware);

/**
 * POST /upgrade
 * Initiates a Stripe Checkout Session for plan upgrade
 */
app.post('/upgrade', async (c) => {
    try {
        const { planId } = await c.req.json();
        const user = c.get('user'); // From JWT

        // Validate Plan
        const targetTier = Object.values(TIERS).find(t => t.id === planId);
        if (!targetTier) {
            return c.json({ error: 'Invalid plan ID' }, 400);
        }

        if (targetTier.id === 'free') {
            // Handle downgrade logic here if needed, or point to portal
            return c.json({ error: 'To downgrade, please use the Billing Portal' }, 400);
        }

        if (!targetTier.stripeMonthlyPriceId) {
            return c.json({ error: 'Plan details missing (Price ID)' }, 500);
        }

        if (!stripe) {
            // Dev Simulation
            return c.json({
                message: 'SIMULATION: Upgrade initiated (Stripe not configured)',
                checkout_url: '#simulation-success',
                note: 'Add STRIPE_SECRET_KEY to .env to enable real payments'
            });
        }

        // Create Checkout Session
        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [
                {
                    price: targetTier.stripeMonthlyPriceId,
                    quantity: 1,
                },
            ],
            customer_email: user.email,
            success_url: `${c.req.header('origin')}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${c.req.header('origin')}/pricing?checkout=cancel`,
            metadata: {
                userId: user.id,
                targetPlan: targetTier.id,
            }
        });

        return c.json({
            checkoutUrl: session.url,
            sessionId: session.id
        });

    } catch (error: any) {
        console.error('[Billing] Upgrade failed:', error);
        return c.json({ error: error.message }, 500);
    }
});

/**
 * GET /usage
 * Returns usage stats for the user (Sum of all API Keys)
 * TODO: Implement Redis aggregation across all keys
 */
app.get('/usage', async (c) => {
    const user = c.get('user');

    // Stub for now - aggregation is complex
    return c.json({
        plan: user.plan || 'free',
        usage: {
            requests: 0,
            limit: 10000,
            remaining: 10000
        },
        message: 'Usage tracking pending migration to user-level aggregation.'
    });
});

export default app;
