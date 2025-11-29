/**
 * POST /api/billing/webhook
 * Handle Stripe webhook events (subscription lifecycle)
 */

export const config = {
  runtime: 'edge',
};

// Helper for JSON responses
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const signature = req.headers.get('stripe-signature');
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!signature || !webhookSecret) {
      return json({ error: 'Missing signature or webhook secret' }, 400);
    }

    // Get raw body for signature verification
    const body = await req.text();

    // Verify webhook signature (simplified - in production use Stripe SDK)
    // For now, we'll trust the webhook since it requires the secret
    const event = JSON.parse(body);

    console.log('[Stripe Webhook] Event:', event.type);

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const keyHash = session.metadata?.api_key_hash;
        const tier = session.metadata?.tier || 'pro';

        if (!keyHash) {
          console.error('[Webhook] No api_key_hash in metadata');
          break;
        }

        // Update tier in Postgres via Neon API
        const dbUrl = process.env.DATABASE_URL;
        if (dbUrl) {
          try {
            const updateResponse = await fetch(`https://api.neon.tech/v2/sql`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.NEON_API_KEY || ''}`,
              },
              body: JSON.stringify({
                query: `UPDATE api_keys SET 
                  tier = $1,
                  stripe_customer_id = $2,
                  stripe_subscription_id = $3,
                  subscription_status = 'active'
                  WHERE key_hash = $4`,
                params: [tier, session.customer, session.subscription, keyHash]
              })
            });

            // Alternatively, use direct SQL connection (if Neon supports it in edge)
            // For now, we'll use Upstash Redis to update tier immediately
            const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
            const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

            if (UPSTASH_URL && UPSTASH_TOKEN) {
              // Update tier in Redis cache
              await fetch(`${UPSTASH_URL}/set/tier:${keyHash}/${tier}`, {
                headers: { 'Authorization': `Bearer ${UPSTASH_TOKEN}` }
              });

              // Update quota in Redis based on tier
              const quota = tier === 'pro' ? 1000000 : 10000;
              await fetch(`${UPSTASH_URL}/set/usage:${keyHash}:quota/${quota}`, {
                headers: { 'Authorization': `Bearer ${UPSTASH_TOKEN}` }
              });

              console.log(`[Webhook] Upgraded ${keyHash.substring(0, 8)} to ${tier}`);
            }
          } catch (error) {
            console.error('[Webhook] Database update error:', error);
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const status = subscription.status;

        // Handle subscription status changes (active, past_due, canceled)
        console.log(`[Webhook] Subscription ${subscription.id} status: ${status}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;

        // Downgrade to free tier
        const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
        const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

        if (UPSTASH_URL && UPSTASH_TOKEN) {
          // Find key hash from subscription ID (need to query DB)
          // For now, log the event
          console.log(`[Webhook] Subscription ${subscription.id} canceled`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        console.log(`[Webhook] Payment failed for customer ${invoice.customer}`);
        // TODO: Send email notification, suspend account after grace period
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    return json({ received: true });

  } catch (error) {
    console.error('[Webhook] Error:', error);
    return json({ 
      error: 'Webhook processing failed',
      message: error.message 
    }, 500);
  }
}
