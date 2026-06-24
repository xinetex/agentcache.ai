/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
import { Hono } from 'hono';
import { authMiddleware } from './auth.js';
import { getAllTiers, TIERS } from '../config/tiers.js';
import { getAgenticMonetizationSummary } from '../config/agenticMonetization.js';
import Stripe from 'stripe';
import { db } from '../db/client.js';
import { users, organizations, members } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { memoryFabricBillingService } from '../services/MemoryFabricBillingService.js';

const app = new Hono<{ Variables: { user: any } }>();
// Initialize Stripe lazily
const stripe = process.env.STRIPE_SECRET_KEY
    ? new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2026-03-25.dahlia' as any })
    : null;

// --- Public Endpoints ---

/**
 * GET /plans
 * Returns comprehensive tier configuration
 */
app.get('/plans', (c) => {
    return c.json({
        tiers: getAllTiers(),
        agentic: getAgenticMonetizationSummary(),
        currency: 'USD'
    });
});

/**
 * GET /monetization
 * Agent-readable commercial contract for plans, add-ons, and usage SKUs.
 */
app.get('/monetization', (c) => {
    return c.json(getAgenticMonetizationSummary());
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

    try {
        const summary = await memoryFabricBillingService.getSummary({ accountId: user.id });

        return c.json({
            plan: user.plan || 'free',
            usage: {
                requests: summary.operations,
                credits: summary.totalCreditsEstimated,
                usd: summary.usdEquivalent,
                breakdown: {
                    reads: summary.reads,
                    writes: summary.writes,
                    proofs: summary.browserProofs
                }
            },
            skus: summary.bySku
        });
    } catch (error) {
        console.error('[Billing] Usage fetch failed:', error);
        return c.json({ error: 'Failed to fetch usage metrics' }, 500);
    }
});

export default app;
