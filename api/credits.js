/**
 * Credits API - Top-Off Billing System
 * AgentCache.ai
 * 
 * Endpoints:
 *   GET  /api/credits              - Get balance and usage summary
 *   GET  /api/credits/packages     - List available credit packages
 *   POST /api/credits/purchase     - Create checkout session for credit purchase
 *   GET  /api/credits/transactions - Get transaction history
 *   GET  /api/credits/auto-topoff  - Get auto top-off settings
 *   POST /api/credits/auto-topoff  - Configure auto top-off
 *   POST /api/credits/deduct       - Internal: Deduct credits for usage (authenticated service)
 */

import { neon } from '@neondatabase/serverless';
import Stripe from 'stripe';
import { getUserFromRequest } from './auth.js';
import {
  CREDIT_PACKAGES,
  STRIPE_CREDIT_PRICE_IDS,
  SERVICE_COSTS,
  AUTO_TOPOFF_THRESHOLDS,
  LOW_BALANCE_WARNING,
  calculateCost,
  formatCredits,
  creditsToUSD,
} from '../src/config/credits.js';

export const config = { runtime: 'nodejs' };

const sql = neon(process.env.DATABASE_URL);
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY) 
  : null;

/**
 * Main API Handler
 */
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { method, url } = req;
  const path = url.split('?')[0];
  const query = new URL(req.url, `http://${req.headers.host}`).searchParams;

  try {
    // ============================================
    // GET /api/credits/packages - Public endpoint
    // ============================================
    if (method === 'GET' && path === '/api/credits/packages') {
      const packages = Object.values(CREDIT_PACKAGES).map(pkg => ({
        ...pkg,
        creditsPerDollar: (pkg.credits / (pkg.price / 100)).toFixed(0),
      }));
      
      return res.status(200).json({
        packages,
        service_costs: SERVICE_COSTS,
        auto_topoff_thresholds: AUTO_TOPOFF_THRESHOLDS,
      });
    }

    // ============================================
    // All other endpoints require auth
    // ============================================
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // ============================================
    // GET /api/credits - Balance & Summary
    // ============================================
    if (method === 'GET' && path === '/api/credits') {
      // Get user's credit balance
      const [userData] = await sql`
        SELECT 
          credit_balance,
          lifetime_credits_purchased,
          lifetime_credits_used
        FROM users 
        WHERE id = ${user.id}
      `;

      const balance = userData?.credit_balance || 0;
      const lifetimePurchased = userData?.lifetime_credits_purchased || 0;
      const lifetimeUsed = userData?.lifetime_credits_used || 0;

      // Get this month's usage
      const [monthUsage] = await sql`
        SELECT 
          COALESCE(SUM(total_credits_used), 0) as credits_used,
          COALESCE(SUM(cache_reads), 0) as cache_reads,
          COALESCE(SUM(ai_embeddings), 0) as ai_embeddings,
          COALESCE(SUM(edge_invocations), 0) as edge_invocations
        FROM credit_usage_daily
        WHERE user_id = ${user.id}
          AND date >= date_trunc('month', CURRENT_DATE)
      `;

      // Get auto top-off settings
      const [topoffSettings] = await sql`
        SELECT enabled, threshold_credits, topoff_package
        FROM auto_topoff_settings
        WHERE user_id = ${user.id}
      `;

      // Recent transactions (last 5)
      const recentTx = await sql`
        SELECT type, amount, description, created_at
        FROM credit_transactions
        WHERE user_id = ${user.id}
        ORDER BY created_at DESC
        LIMIT 5
      `;

      return res.status(200).json({
        balance: {
          credits: balance,
          usd: creditsToUSD(balance),
          formatted: formatCredits(balance),
          low_balance: balance < LOW_BALANCE_WARNING,
        },
        lifetime: {
          purchased: lifetimePurchased,
          used: lifetimeUsed,
        },
        this_month: {
          credits_used: parseFloat(monthUsage?.credits_used || 0),
          cache_reads: parseInt(monthUsage?.cache_reads || 0),
          ai_embeddings: parseInt(monthUsage?.ai_embeddings || 0),
          edge_invocations: parseInt(monthUsage?.edge_invocations || 0),
        },
        auto_topoff: topoffSettings || { enabled: false },
        recent_transactions: recentTx,
      });
    }

    // ============================================
    // POST /api/credits/purchase - Create Checkout
    // ============================================
    if (method === 'POST' && path === '/api/credits/purchase') {
      const { package_id, api_key_hash } = req.body;

      if (!package_id || !CREDIT_PACKAGES[package_id]) {
        return res.status(400).json({ 
          error: 'Invalid package',
          available: Object.keys(CREDIT_PACKAGES),
        });
      }

      if (!api_key_hash) {
        return res.status(400).json({
          error: 'api_key_hash required to attribute credits',
        });
      }

      const pkg = CREDIT_PACKAGES[package_id];
      const priceId = STRIPE_CREDIT_PRICE_IDS[package_id];

      if (!stripe) {
        // Dev mode fallback
        return res.status(200).json({
          message: 'SIMULATION: Purchase initiated (Stripe not configured)',
          package: pkg,
          checkout_url: '#simulation',
          note: 'Add STRIPE_SECRET_KEY to enable real payments',
        });
      }

      // Create Stripe Checkout Session
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: `AgentCache Credits - ${pkg.credits} credits`,
              description: pkg.bonus > 0 
                ? `Includes ${pkg.bonus} bonus credits!` 
                : `${pkg.credits} credits for AgentCache services`,
            },
            unit_amount: pkg.price,
          },
          quantity: 1,
        }],
        customer_email: user.email,
        metadata: {
          type: 'credit_purchase',
          user_id: user.id,
          package_id,
          credits: pkg.credits,
          api_key_hash,
        },
        success_url: `${req.headers.origin}/dashboard?purchase=success&credits=${pkg.credits}`,
        cancel_url: `${req.headers.origin}/dashboard?purchase=cancelled`,
      });

      return res.status(200).json({
        checkout_url: session.url,
        session_id: session.id,
        package: pkg,
      });
    }

    // ============================================
    // GET /api/credits/transactions - History
    // ============================================
    if (method === 'GET' && path === '/api/credits/transactions') {
      const limit = Math.min(parseInt(query.get('limit') || '50'), 100);
      const offset = parseInt(query.get('offset') || '0');
      const type = query.get('type'); // Optional filter

      let transactions;
      if (type) {
        transactions = await sql`
          SELECT * FROM credit_transactions
          WHERE user_id = ${user.id} AND type = ${type}
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else {
        transactions = await sql`
          SELECT * FROM credit_transactions
          WHERE user_id = ${user.id}
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
      }

      const [countResult] = await sql`
        SELECT COUNT(*) as total FROM credit_transactions
        WHERE user_id = ${user.id}
      `;

      return res.status(200).json({
        transactions,
        pagination: {
          total: parseInt(countResult.total),
          limit,
          offset,
          has_more: offset + transactions.length < parseInt(countResult.total),
        },
      });
    }

    // ============================================
    // GET /api/credits/auto-topoff - Get Settings
    // ============================================
    if (method === 'GET' && path === '/api/credits/auto-topoff') {
      const [settings] = await sql`
        SELECT * FROM auto_topoff_settings
        WHERE user_id = ${user.id}
      `;

      // Get saved payment methods if Stripe customer exists
      let paymentMethods = [];
      if (stripe && user.stripe_customer_id) {
        try {
          const methods = await stripe.paymentMethods.list({
            customer: user.stripe_customer_id,
            type: 'card',
          });
          paymentMethods = methods.data.map(m => ({
            id: m.id,
            brand: m.card.brand,
            last4: m.card.last4,
            exp: `${m.card.exp_month}/${m.card.exp_year}`,
          }));
        } catch (e) {
          console.warn('Failed to fetch payment methods:', e.message);
        }
      }

      return res.status(200).json({
        settings: settings || {
          enabled: false,
          threshold_credits: 100,
          topoff_package: 'pack_2500',
        },
        payment_methods: paymentMethods,
        available_packages: Object.values(CREDIT_PACKAGES),
        thresholds: AUTO_TOPOFF_THRESHOLDS,
      });
    }

    // ============================================
    // POST /api/credits/auto-topoff - Configure
    // ============================================
    if (method === 'POST' && path === '/api/credits/auto-topoff') {
      const { enabled, threshold_credits, topoff_package, payment_method_id } = req.body;

      // Validate package if provided
      if (topoff_package && !CREDIT_PACKAGES[topoff_package]) {
        return res.status(400).json({ error: 'Invalid package' });
      }

      // Upsert settings
      await sql`
        INSERT INTO auto_topoff_settings (
          user_id, enabled, threshold_credits, topoff_package, stripe_payment_method_id, updated_at
        ) VALUES (
          ${user.id},
          ${enabled ?? false},
          ${threshold_credits ?? 100},
          ${topoff_package ?? 'pack_2500'},
          ${payment_method_id ?? null},
          NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
          enabled = EXCLUDED.enabled,
          threshold_credits = EXCLUDED.threshold_credits,
          topoff_package = EXCLUDED.topoff_package,
          stripe_payment_method_id = EXCLUDED.stripe_payment_method_id,
          updated_at = NOW()
      `;

      return res.status(200).json({
        message: 'Auto top-off settings updated',
        settings: {
          enabled: enabled ?? false,
          threshold_credits: threshold_credits ?? 100,
          topoff_package: topoff_package ?? 'pack_2500',
        },
      });
    }

    // ============================================
    // POST /api/credits/deduct - Internal Usage
    // ============================================
    if (method === 'POST' && path === '/api/credits/deduct') {
      // This endpoint should be called by internal services
      // Add additional auth check for service-to-service calls
      const serviceKey = req.headers['x-service-key'];
      if (serviceKey !== process.env.INTERNAL_SERVICE_KEY && !user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { user_id, service, quantity, resource_id, description } = req.body;
      const targetUserId = user_id || user?.id;

      if (!targetUserId || !service) {
        return res.status(400).json({ error: 'user_id and service required' });
      }

      const cost = calculateCost(service, quantity || 1);
      if (cost === 0) {
        return res.status(400).json({ error: 'Unknown service or zero cost' });
      }

      // Deduct credits atomically
      const [result] = await sql`
        UPDATE users 
        SET 
          credit_balance = credit_balance - ${cost},
          lifetime_credits_used = lifetime_credits_used + ${cost}
        WHERE id = ${targetUserId} AND credit_balance >= ${cost}
        RETURNING credit_balance
      `;

      if (!result) {
        // Insufficient balance - check if auto top-off should trigger
        const [userData] = await sql`
          SELECT credit_balance FROM users WHERE id = ${targetUserId}
        `;
        
        return res.status(402).json({
          error: 'Insufficient credits',
          required: cost,
          balance: userData?.credit_balance || 0,
          topoff_url: '/dashboard?topoff=true',
        });
      }

      // Record transaction
      await sql`
        INSERT INTO credit_transactions (
          user_id, type, amount, balance_after, service, resource_id, quantity, description
        ) VALUES (
          ${targetUserId}, 'usage', ${-cost}, ${result.credit_balance},
          ${service}, ${resource_id || null}, ${quantity || 1},
          ${description || `${service} x ${quantity || 1}`}
        )
      `;

      // Update daily aggregation
      await sql`
        INSERT INTO credit_usage_daily (user_id, date, total_credits_used, ${sql.raw(service.replace(/-/g, '_'))})
        VALUES (${targetUserId}, CURRENT_DATE, ${cost}, ${quantity || 1})
        ON CONFLICT (user_id, date) DO UPDATE SET
          total_credits_used = credit_usage_daily.total_credits_used + ${cost},
          ${sql.raw(service.replace(/-/g, '_'))} = credit_usage_daily.${sql.raw(service.replace(/-/g, '_'))} + ${quantity || 1}
      `;

      // Check if auto top-off should trigger
      if (result.credit_balance < LOW_BALANCE_WARNING) {
        // Trigger async top-off check (don't block the response)
        triggerAutoTopoffCheck(targetUserId).catch(console.error);
      }

      return res.status(200).json({
        success: true,
        deducted: cost,
        balance: result.credit_balance,
        service,
      });
    }

    // Route not found
    return res.status(404).json({ error: 'Endpoint not found' });

  } catch (error) {
    console.error('Credits API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}

/**
 * Check and trigger auto top-off if enabled
 */
async function triggerAutoTopoffCheck(userId) {
  const [settings] = await sql`
    SELECT * FROM auto_topoff_settings
    WHERE user_id = ${userId} AND enabled = true
  `;

  if (!settings) return;

  const [userData] = await sql`
    SELECT credit_balance FROM users WHERE id = ${userId}
  `;

  if (userData.credit_balance >= settings.threshold_credits) return;

  // Check if we have a payment method
  if (!settings.stripe_payment_method_id || !stripe) {
    console.log(`[Auto Top-off] User ${userId} needs top-off but no payment method`);
    // TODO: Send notification email
    return;
  }

  // Prevent duplicate charges (check last top-off time)
  if (settings.last_topoff_at) {
    const lastTopoff = new Date(settings.last_topoff_at);
    const hoursSince = (Date.now() - lastTopoff.getTime()) / (1000 * 60 * 60);
    if (hoursSince < 1) {
      console.log(`[Auto Top-off] Skipping - last top-off was ${hoursSince.toFixed(1)}h ago`);
      return;
    }
  }

  const pkg = CREDIT_PACKAGES[settings.topoff_package];
  if (!pkg) return;

  try {
    // Create payment intent with saved payment method
    const paymentIntent = await stripe.paymentIntents.create({
      amount: pkg.price,
      currency: 'usd',
      customer: (await sql`SELECT stripe_customer_id FROM users WHERE id = ${userId}`)[0]?.stripe_customer_id,
      payment_method: settings.stripe_payment_method_id,
      off_session: true,
      confirm: true,
      metadata: {
        userId,
        packageId: settings.topoff_package,
        credits: pkg.credits,
        type: 'auto_topoff',
      },
    });

    if (paymentIntent.status === 'succeeded') {
      // Add credits
      await addCreditsToUser(userId, pkg.credits, {
        type: 'auto_topoff',
        packageId: settings.topoff_package,
        stripePaymentIntentId: paymentIntent.id,
      });

      // Update last top-off time
      await sql`
        UPDATE auto_topoff_settings 
        SET last_topoff_at = NOW() 
        WHERE user_id = ${userId}
      `;

      console.log(`[Auto Top-off] Success: Added ${pkg.credits} credits to user ${userId}`);
    }
  } catch (error) {
    console.error(`[Auto Top-off] Failed for user ${userId}:`, error.message);
    // TODO: Disable auto top-off and notify user if payment fails
  }
}

/**
 * Add credits to a user (called after successful payment)
 */
export async function addCreditsToUser(userId, credits, metadata = {}) {
  const [result] = await sql`
    UPDATE users 
    SET 
      credit_balance = credit_balance + ${credits},
      lifetime_credits_purchased = lifetime_credits_purchased + ${credits}
    WHERE id = ${userId}
    RETURNING credit_balance
  `;

  await sql`
    INSERT INTO credit_transactions (
      user_id, type, amount, balance_after, package_id, 
      stripe_payment_intent_id, stripe_checkout_session_id, description
    ) VALUES (
      ${userId}, ${metadata.type || 'purchase'}, ${credits}, ${result.credit_balance},
      ${metadata.packageId || null}, ${metadata.stripePaymentIntentId || null},
      ${metadata.stripeCheckoutSessionId || null},
      ${metadata.description || `Purchased ${credits} credits`}
    )
  `;

  return result.credit_balance;
}
