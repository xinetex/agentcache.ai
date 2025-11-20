const Stripe = require('stripe');

module.exports = async (req, res) => {
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
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: price,
          quantity: 1,
        },
      ],
      success_url: `${req.headers.origin || req.headers.host || 'https://agentcache.ai'}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin || req.headers.host || 'https://agentcache.ai'}/login.html`,
      customer_email: email || undefined,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      metadata: {
        source: 'agentcache_website'
      }
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

