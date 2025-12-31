/**
 * Billing API
 * Usage tracking, cost calculation, and subscription management
 */

import { neon } from '@neondatabase/serverless';
import Stripe from 'stripe';

export const config = {
  runtime: 'nodejs'
};
import { getUserFromRequest } from './auth.js';
import { calculateMonthlyBill, COMPLEXITY_TIERS, calculateComplexity } from '../lib/complexity-calculator.js';
import { PLAN_PRICES, QUOTAS, FEATURES, STRIPE_PRICE_IDS } from '../src/config/pricing.js';

const sql = neon(process.env.DATABASE_URL);
// Initialize Stripe lazily or check for key to avoid crashes in dev
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

/**
 * Main API handler
 */
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Require authentication
  const user = await getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }

  const { method, url } = req;
  const path = url.split('?')[0];

  try {
    // GET /api/billing/usage - Current period usage
    if (method === 'GET' && path === '/api/billing/usage') {
      // Get subscription
      const subscriptions = await sql`
        SELECT plan_tier, current_period_start, current_period_end, status
        FROM subscriptions
        WHERE user_id = ${user.id} AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const subscription = subscriptions[0] || {
        plan_tier: 'starter',
        current_period_start: new Date(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'active'
      };

      // Get current month usage
      const usage = await sql`
        SELECT * FROM get_current_month_usage(${user.id})
      `;

      const currentUsage = usage[0] || {
        requests: 0,
        hits: 0,
        hit_rate: 0,
        cost_saved: 0
      };

      // Get active pipelines for cost calculation
      const pipelines = await sql`
        SELECT id, name, complexity_tier, monthly_cost, status
        FROM pipelines
        WHERE user_id = ${user.id} AND status = 'active'
      `;

      // Calculate bill
      const bill = calculateMonthlyBill(pipelines, subscription.plan_tier);

      // Request quotas by plan
      // Request quotas by plan
      const quotas = QUOTAS;

      return res.status(200).json({
        current_period: {
          start: subscription.current_period_start,
          end: subscription.current_period_end,
          requests: parseInt(currentUsage.requests),
          hits: parseInt(currentUsage.hits),
          hit_rate: parseFloat(currentUsage.hit_rate),
          cost_saved: parseFloat(currentUsage.cost_saved),
          quota: quotas[subscription.plan_tier],
          quota_percentage: Math.round((parseInt(currentUsage.requests) / quotas[subscription.plan_tier]) * 100)
        },
        subscription: {
          plan: subscription.plan_tier,
          status: subscription.status
        },
        billing: {
          base_cost: bill.base_cost,
          pipeline_costs: bill.pipeline_costs,
          total: bill.total,
          line_items: bill.line_items
        },
        pipelines: pipelines.map(p => ({
          id: p.id,
          name: p.name,
          complexity: p.complexity_tier,
          cost: parseFloat(p.monthly_cost)
        }))
      });
    }

    // POST /api/billing/calculate - Calculate cost for pipeline config
    if (method === 'POST' && path === '/api/billing/calculate') {
      const { pipeline } = req.body;

      if (!pipeline || !pipeline.nodes) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Pipeline configuration with nodes required'
        });
      }

      // Calculate complexity
      const complexity = calculateComplexity(pipeline);

      // Get user's plan
      const subscriptions = await sql`
        SELECT plan_tier FROM subscriptions
        WHERE user_id = ${user.id} AND status = 'active'
        ORDER BY created_at DESC LIMIT 1
      `;

      const userPlan = subscriptions[0]?.plan_tier || 'starter';

      // Check if included in plan
      const includedInPlan = (
        (userPlan === 'starter' && complexity.tier === 'simple') ||
        (userPlan === 'professional' && ['simple', 'moderate'].includes(complexity.tier)) ||
        (userPlan === 'enterprise')
      );

      return res.status(200).json({
        complexity: complexity.tier,
        score: complexity.score,
        monthly_cost: complexity.cost,
        description: complexity.description,
        breakdown: complexity.breakdown,
        included_in_plan: includedInPlan,
        requires_upgrade: !includedInPlan && complexity.cost > 0,
        user_plan: userPlan
      });
    }

    // GET /api/billing/history - Invoice history
    if (method === 'GET' && path === '/api/billing/history') {
      const invoices = await sql`
        SELECT 
          stripe_invoice_id,
          amount_due,
          amount_paid,
          status,
          period_start,
          period_end,
          paid_at,
          stripe_invoice_url
        FROM invoices
        WHERE user_id = ${user.id}
        ORDER BY period_start DESC
        LIMIT 12
      `;

      return res.status(200).json({
        invoices: invoices.map(inv => ({
          id: inv.stripe_invoice_id,
          amount: parseFloat(inv.amount_due),
          paid: parseFloat(inv.amount_paid),
          status: inv.status,
          period: {
            start: inv.period_start,
            end: inv.period_end
          },
          paid_at: inv.paid_at,
          invoice_url: inv.stripe_invoice_url
        }))
      });
    }

    // GET /api/billing/plans - Available plans
    if (method === 'GET' && path === '/api/billing/plans') {
      const plans = Object.keys(PLAN_PRICES).map(id => ({
        id,
        name: id.charAt(0).toUpperCase() + id.slice(1),
        price: PLAN_PRICES[id],
        features: FEATURES[id],
        limits: {
          // Mapping back simplified limits for frontend compat
          pipelines: id === 'starter' ? 3 : (id === 'professional' ? 10 : Infinity),
          requests: QUOTAS[id],
          max_complexity: id === 'starter' ? 'simple' : (id === 'professional' ? 'moderate' : 'enterprise')
        }
      }));

      return res.status(200).json({
        plans,
        complexity_tiers: Object.entries(COMPLEXITY_TIERS).map(([key, tier]) => ({
          id: key,
          cost: tier.cost,
          description: tier.description,
          max_nodes: tier.max_nodes
        }))
      });
    }

    // POST /api/billing/upgrade - Initiate plan upgrade
    if (method === 'POST' && path === '/api/billing/upgrade') {
      const { plan } = req.body;

      if (!['starter', 'professional', 'enterprise'].includes(plan)) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Invalid plan'
        });
      }

      // Get current subscription
      const subscriptions = await sql`
        SELECT plan_tier, stripe_subscription_id
        FROM subscriptions
        WHERE user_id = ${user.id} AND status = 'active'
        ORDER BY created_at DESC LIMIT 1
      `;

      const currentPlan = subscriptions[0]?.plan_tier || 'starter';

      if (currentPlan === plan) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'Already on this plan'
        });
      }

      // In production, this would create a Stripe checkout session
      try {
        if (!process.env.STRIPE_SECRET_KEY) {
          throw new Error("Stripe is not configured (missing STRIPE_SECRET_KEY)");
        }

        // 1. Get Price ID
        const priceId = STRIPE_PRICE_IDS[plan];
        if (!priceId) {
          return res.status(400).json({ error: 'Config error', message: `No price ID for plan ${plan}` });
        }

        // 2. Create Checkout Session
        const session = await stripe.checkout.sessions.create({
          mode: 'subscription',
          payment_method_types: ['card'],
          line_items: [
            {
              price: priceId,
              quantity: 1,
            },
          ],
          customer_email: user.email, // Pre-fill email
          success_url: `${req.headers.origin}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${req.headers.origin}/pricing?checkout=cancel`,
          metadata: {
            userId: user.id,
            targetPlan: plan,
            orgId: 'TODO_ORG_ID' // Ideally pass this if available
          }
        });

        return res.status(200).json({
          message: 'Upgrade initiated',
          checkout_url: session.url,
          upgrade: {
            from: currentPlan,
            to: plan,
            price_change: PLAN_PRICES[plan] - PLAN_PRICES[currentPlan]
          }
        });

      } catch (err) {
        console.error('[Stripe Error]', err);
        // Fallback for simulation/dev if no key
        if (err.message.includes('missing STRIPE_SECRET_KEY')) {
          return res.status(200).json({
            message: 'SIMULATION: Upgrade initiated (Stripe not configured)',
            checkout_url: '#simulation-success',
            note: 'Add STRIPE_SECRET_KEY to .env to enable real payments'
          });
        }

        return res.status(500).json({ error: 'Payment initialization failed', details: err.message });
      }
    }

    // POST /api/billing/track - Track usage event (internal use)
    if (method === 'POST' && path === '/api/billing/track') {
      const { pipeline_id, cache_hit, tokens, baseline_cost, agentcache_cost } = req.body;

      // Verify pipeline ownership
      if (pipeline_id) {
        const pipelines = await sql`
          SELECT id FROM pipelines
          WHERE id = ${pipeline_id} AND user_id = ${user.id}
        `;

        if (pipelines.length === 0) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Pipeline not found'
          });
        }
      }

      // Record usage
      await sql`
        INSERT INTO usage_metrics (
          user_id,
          pipeline_id,
          timestamp,
          date,
          cache_requests,
          cache_hits,
          cache_misses,
          tokens_processed,
          cost_baseline,
          cost_agentcache,
          cost_saved
        )
        VALUES (
          ${user.id},
          ${pipeline_id || null},
          NOW(),
          CURRENT_DATE,
          1,
          ${cache_hit ? 1 : 0},
          ${cache_hit ? 0 : 1},
          ${tokens || 0},
          ${baseline_cost || 0},
          ${agentcache_cost || 0},
          ${(baseline_cost || 0) - (agentcache_cost || 0)}
        )
        ON CONFLICT (user_id, date, pipeline_id) DO UPDATE SET
          cache_requests = usage_metrics.cache_requests + 1,
          cache_hits = usage_metrics.cache_hits + EXCLUDED.cache_hits,
          cache_misses = usage_metrics.cache_misses + EXCLUDED.cache_misses,
          tokens_processed = usage_metrics.tokens_processed + EXCLUDED.tokens_processed,
          cost_baseline = usage_metrics.cost_baseline + EXCLUDED.cost_baseline,
          cost_agentcache = usage_metrics.cost_agentcache + EXCLUDED.cost_agentcache,
          cost_saved = usage_metrics.cost_saved + EXCLUDED.cost_saved
      `;

      return res.status(200).json({
        message: 'Usage tracked'
      });
    }

    // Route not found
    return res.status(404).json({
      error: 'Not found',
      message: 'Billing endpoint not found'
    });

  } catch (error) {
    console.error('Billing API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
