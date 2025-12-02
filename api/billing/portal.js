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
    const keyHash = hashApiKey(apiKey);
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
    const publicUrl = process.env.PUBLIC_URL || 'https://agentcache.ai';

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${publicUrl}/dashboard.html?key=${apiKey}`,
    });

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
