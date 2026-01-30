import Stripe from 'stripe';

// Specify Node.js runtime for Stripe SDK compatibility
export const config = {
  runtime: 'nodejs',
};

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
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  // Only allow POST and GET
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { price, email } = req.query;

  if (!price) {
    return res.status(400).json({ error: 'Price ID required' });
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
        userId: email ? undefined : 'TODO_USER_ID_FROM_AUTH', // We need to fix this to actually get user context if possible, or rely on email match
        // Ideally checkout.js should be an authenticated endpoint like billing.js
        // For now, we will rely on email matching in the webhook if userId is missing
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

