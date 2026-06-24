import Stripe from 'stripe';
import {
  getBillingPlanByStripePriceId,
  isPlaceholderStripePriceId,
} from '../lib/billing-plans.js';
import {
  getBillingAddonByStripePriceId,
  isPlaceholderAddonStripePriceId,
} from '../lib/billing-addons.js';

// Specify Node.js runtime for Stripe SDK compatibility
export const config = {
  runtime: 'nodejs',
};

function firstQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function getAllowedPriceMetadata(priceId) {
  const plan = getBillingPlanByStripePriceId(priceId);
  if (plan && !isPlaceholderStripePriceId(priceId)) {
    return {
      type: 'plan_upgrade',
      target_public_plan: plan.publicId,
      target_plan: plan.internalId,
    };
  }

  const addon = getBillingAddonByStripePriceId(priceId);
  if (addon && !isPlaceholderAddonStripePriceId(priceId)) {
    return {
      type: 'addon_purchase',
      addon_id: addon.id,
    };
  }

  return null;
}

export default async function handler(req, res) {
  // Debug: Check if Stripe key is available
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('STRIPE_SECRET_KEY is not set!');
    return res.status(500).json({
      error: 'Stripe configuration error',
      details: 'Missing STRIPE_SECRET_KEY environment variable'
    });
  }

  // Initialize Stripe with the secret key
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-03-25.dahlia' });

  // Only allow POST and GET
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const price = firstQueryValue(req.query.price);
  const email = firstQueryValue(req.query.email);

  if (!price) {
    return res.status(400).json({ error: 'Price ID required' });
  }

  const priceMetadata = getAllowedPriceMetadata(price);
  if (!priceMetadata) {
    return res.status(400).json({
      error: 'Invalid price ID',
      message: 'Use a configured AgentCache plan or add-on price. Authenticated billing should use /api/billing/create-checkout.',
    });
  }

  try {
    // Construct base URL
    let baseUrl = req.headers.origin;
    if (!baseUrl) {
      const host = req.headers.host;
      if (host) {
        // Assume https unless localhost
        const protocol = host.includes('localhost') ? 'http' : 'https';
        baseUrl = `${protocol}://${host}`;
      } else {
        baseUrl = 'https://agentcache.ai';
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: price,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/login.html`,
      customer_email: email || undefined,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      metadata: {
        source: 'agentcache_website',
        legacyCheckout: 'true',
        ...priceMetadata,
      },
      client_reference_id: email // helping us match just in case
    });

    // Redirect to Stripe Checkout
    res.redirect(303, session.url);
  } catch (error) {
    console.error('Stripe checkout error:', error);
    res.status(500).json({
      error: error.message,
      type: error.type || 'unknown',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
