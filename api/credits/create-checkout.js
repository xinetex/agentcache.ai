import crypto from 'crypto';
import Stripe from 'stripe';
import { CREDIT_PACKAGES } from '../../src/config/credits.js';

export const config = { runtime: 'nodejs' };

function json(res, data, status = 200) {
  return res.status(status).json(data);
}

function getHeader(req, name) {
  const v = req.headers?.[name.toLowerCase()] ?? req.headers?.[name];
  return Array.isArray(v) ? v[0] : v;
}

function getApiKey(req) {
  const apiKey = getHeader(req, 'x-api-key') || getHeader(req, 'X-API-Key');
  if (apiKey) return apiKey;

  const auth = getHeader(req, 'authorization') || getHeader(req, 'Authorization');
  if (auth && auth.startsWith('Bearer ')) return auth.slice('Bearer '.length);
  return null;
}

function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return json(res, { error: 'Method not allowed' }, 405);
  }

  try {
    const apiKey = getApiKey(req);
    if (!apiKey || !apiKey.startsWith('ac_')) {
      return json(res, { error: 'Invalid or missing API key' }, 401);
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { package_id } = body;

    if (!package_id || !CREDIT_PACKAGES[package_id]) {
      return json(res, {
        error: 'Invalid package',
        available: Object.keys(CREDIT_PACKAGES)
      }, 400);
    }

    const pkg = CREDIT_PACKAGES[package_id];
    const keyHash = hashApiKey(apiKey);

    const origin = getHeader(req, 'origin') || 'https://agentcache.ai';

    if (!process.env.STRIPE_SECRET_KEY) {
      // Dev mode fallback
      return json(res, {
        message: 'SIMULATION: Credits purchase initiated (Stripe not configured)',
        package: pkg,
        checkoutUrl: `${origin}/topoff?success=1&mock=1`,
        note: 'Add STRIPE_SECRET_KEY to enable real payments',
      }, 200);
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `AgentCache Credits — ${pkg.credits} credits`,
            description: pkg.bonus > 0
              ? `Includes ${pkg.bonus} bonus credits.`
              : `${pkg.credits} credits for AgentCache overages and services.`,
          },
          unit_amount: pkg.price,
        },
        quantity: 1,
      }],
      metadata: {
        type: 'credit_purchase',
        api_key_hash: keyHash,
        package_id,
        credits: String(pkg.credits),
      },
      success_url: `${origin}/topoff?success=1`,
      cancel_url: `${origin}/topoff?canceled=1`,
    });

    return json(res, {
      checkoutUrl: session.url,
      sessionId: session.id,
      package: pkg,
    });

  } catch (error) {
    console.error('[Credits] create-checkout error:', error);
    return json(res, { error: 'Failed to create checkout session', details: error.message }, 500);
  }
}
