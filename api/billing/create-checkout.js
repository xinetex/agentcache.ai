/**
 * POST /api/billing/create-checkout
 * Create Stripe checkout session for tier upgrade
 */

export const config = {
  runtime: 'nodejs',
};

// Helper to hash API key
async function hashApiKey(apiKey) {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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
    const keyHash = await hashApiKey(apiKey);

    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'payment_method_types[]': 'card',
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
        'mode': 'subscription',
        'success_url': `${process.env.PUBLIC_URL || 'https://agentcache.ai'}/dashboard.html?key=${apiKey}&upgraded=true`,
        'cancel_url': `${process.env.PUBLIC_URL || 'https://agentcache.ai'}/pricing.html`,
        'metadata[api_key_hash]': keyHash,
        'metadata[tier]': tier,
      }).toString()
    });

    if (!stripeResponse.ok) {
      const error = await stripeResponse.text();
      console.error('[Stripe] Checkout error:', error);
      return json({ error: 'Failed to create checkout session' }, 500);
    }

    const session = await stripeResponse.json();

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
