/**
 * GET /api/billing/portal
 * Create Stripe billing portal session for subscription management
 */

export const config = {
  runtime: 'edge',
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
  if (req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    // Get API key from header
    const apiKey = req.headers.get('x-api-key') || 
                   req.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!apiKey || !apiKey.startsWith('ac_')) {
      return json({ error: 'Invalid or missing API key' }, 401);
    }

    // Get stripe_customer_id from Redis or Postgres
    const keyHash = await hashApiKey(apiKey);
    const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
    const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

    // First check Redis for cached customer ID
    let customerId = null;
    
    if (UPSTASH_URL && UPSTASH_TOKEN) {
      const cacheResponse = await fetch(`${UPSTASH_URL}/get/stripe:${keyHash}:customer`, {
        headers: { 'Authorization': `Bearer ${UPSTASH_TOKEN}` }
      });
      
      if (cacheResponse.ok) {
        const cacheData = await cacheResponse.json();
        customerId = cacheData.result;
      }
    }

    if (!customerId) {
      return json({ 
        error: 'No active subscription',
        message: 'You need to subscribe to a paid plan first'
      }, 404);
    }

    // Create Stripe billing portal session
    const stripeResponse = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'customer': customerId,
        'return_url': `${process.env.PUBLIC_URL || 'https://agentcache.ai'}/dashboard.html?key=${apiKey}`,
      }).toString()
    });

    if (!stripeResponse.ok) {
      const error = await stripeResponse.text();
      console.error('[Stripe] Portal error:', error);
      return json({ error: 'Failed to create billing portal session' }, 500);
    }

    const session = await stripeResponse.json();

    return json({
      success: true,
      portalUrl: session.url,
    });

  } catch (error) {
    console.error('[Billing] Portal error:', error);
    return json({ 
      error: 'Failed to create portal session',
      message: error.message 
    }, 500);
  }
}
