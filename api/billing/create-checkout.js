import Stripe from 'stripe';
import { createHash } from 'crypto';

export const config = {
  runtime: 'nodejs',
};

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
  return createHash('sha256').update(apiKey).digest('hex');
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
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = getApiKey(req);
    if (!apiKey || !apiKey.startsWith('ac_')) {
      return res.status(401).json({ error: 'Invalid or missing API key' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { tier = 'pro', billingPeriod = 'monthly' } = body;

    if (tier !== 'pro') {
      return res.status(400).json({
        error: 'Only Pro tier is available for self-service upgrade',
        message: 'For Enterprise, please contact sales@agentcache.ai',
      });
    }

    const priceId = billingPeriod === 'yearly'
      ? process.env.STRIPE_PRICE_PRO_YEARLY
      : process.env.STRIPE_PRICE_PRO_MONTHLY;

    if (!priceId || !process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({
        error: 'Stripe not configured',
        message: 'Please contact support@agentcache.ai',
      });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const keyHash = hashApiKey(apiKey);
    const publicUrl = process.env.PUBLIC_URL || 'https://agentcache.ai';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${publicUrl}/dashboard.html?key=${apiKey}&upgraded=true`,
      cancel_url: `${publicUrl}/pricing.html`,
      metadata: {
        api_key_hash: keyHash,
        tier,
      },
    });

    return res.status(200).json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id,
    });

  } catch (error) {
    console.error('[Billing] Create checkout error:', error);
    return res.status(500).json({
      error: 'Failed to create checkout',
      message: error.message,
    });
  }
}
