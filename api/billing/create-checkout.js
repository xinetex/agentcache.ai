import Stripe from 'stripe';
import { createHash } from 'crypto';

export const config = {
  runtime: 'nodejs',
};

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Helper to hash API key
function hashApiKey(apiKey) {
  return createHash('sha256').update(apiKey).digest('hex');
}

// Helper for JSON responses
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    },
  });
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    // Get API key from header
    const apiKey = req.headers.get('x-api-key') ||
      req.headers.get('authorization')?.replace('Bearer ', '');

    if (!apiKey || !apiKey.startsWith('ac_')) {
      return json({ error: 'Invalid or missing API key' }, 401);
    }

    const body = await req.json();
    const { tier = 'pro', billingPeriod = 'monthly' } = body;

    // Validate tier
    if (tier !== 'pro') {
      return json({
        error: 'Only Pro tier is available for self-service upgrade',
        message: 'For Enterprise, please contact sales@agentcache.ai'
      }, 400);
    }

    // Get Stripe price ID from environment
    const priceId = billingPeriod === 'yearly'
      ? process.env.STRIPE_PRICE_PRO_YEARLY
      : process.env.STRIPE_PRICE_PRO_MONTHLY;

    if (!priceId) {
      return json({
        error: 'Stripe not configured',
        message: 'Please contact support@agentcache.ai'
      }, 500);
    }

    // Create Stripe checkout session
    const keyHash = hashApiKey(apiKey);
    const publicUrl = process.env.PUBLIC_URL || 'https://agentcache.ai';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${publicUrl}/dashboard.html?key=${apiKey}&upgraded=true`,
      cancel_url: `${publicUrl}/pricing.html`,
      metadata: {
        api_key_hash: keyHash,
        tier: tier,
      },
    });

    return json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id,
    });

  } catch (error) {
    console.error('[Billing] Create checkout error:', error);
    return json({
      error: 'Failed to create checkout',
      message: error.message
    }, 500);
  }
}
