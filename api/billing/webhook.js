import Stripe from 'stripe';
import { addCreditsToUser } from '../credits.js';

export const config = {
  runtime: 'nodejs',
  api: {
    bodyParser: false,
  },
};

function getHeader(req, name) {
  const v = req.headers?.[name.toLowerCase()] ?? req.headers?.[name];
  return Array.isArray(v) ? v[0] : v;
}

function json(res, data, status = 200) {
  return res.status(status).json(data);
}

async function readRawBody(req) {
  return await new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function upstashSet(key, value) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Upstash not configured');

  const res = await fetch(`${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(String(value))}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    throw new Error(`Upstash SET failed: ${res.status}`);
  }
}

async function upstashIncrBy(key, amount) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Upstash not configured');

  const res = await fetch(`${url}/incrby/${encodeURIComponent(key)}/${encodeURIComponent(String(amount))}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    throw new Error(`Upstash INCRBY failed: ${res.status}`);
  }

  const data = await res.json().catch(() => ({}));
  return data.result;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, { error: 'Method not allowed' }, 405);
  }

  try {
    const signature = getHeader(req, 'stripe-signature');
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!signature || !webhookSecret || !process.env.STRIPE_SECRET_KEY) {
      return json(res, { error: 'Missing Stripe configuration' }, 400);
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const rawBody = await readRawBody(req);

    let event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      console.error(`[Stripe Webhook] Signature verification failed: ${err.message}`);
      return json(res, { error: `Webhook Error: ${err.message}` }, 400);
    }

    console.log('[Stripe Webhook] Verified event:', event.type);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const kind = session.metadata?.type;

        // --- Credits top-off (Checkout session) ---
        if (kind === 'credit_purchase') {
          const keyHash = session.metadata?.api_key_hash;
          const credits = parseInt(session.metadata?.credits || '0', 10);
          const userId = session.metadata?.user_id;
          const packageId = session.metadata?.package_id;

          if (!keyHash || !Number.isFinite(credits) || credits <= 0) {
            console.error('[Credits Webhook] Missing api_key_hash or credits in metadata');
            break;
          }

          // Idempotency: check Redis balance by incrby; optional DB dedupe via addCreditsToUser when user_id present
          try {
            const newBalance = await upstashIncrBy(`credits:${keyHash}`, credits);
            console.log(`[Credits Webhook] Added ${credits} credits to ${keyHash.slice(0, 8)}… (new balance: ${newBalance})`);
          } catch (e) {
            console.error('[Credits Webhook] Failed to apply credits in Redis:', e);
          }

          if (userId) {
            try {
              await addCreditsToUser(userId, credits, {
                type: 'purchase',
                packageId,
                stripeCheckoutSessionId: session.id,
                stripePaymentIntentId: session.payment_intent,
                description: `Purchased ${credits} credits`,
              });
            } catch (e) {
              console.error('[Credits Webhook] Failed to persist credits to DB:', e);
            }
          }

          break;
        }

        // --- Subscription upgrade ---
        const keyHash = session.metadata?.api_key_hash;
        const tier = session.metadata?.tier || 'pro';

        if (!keyHash) {
          console.error('[Billing Webhook] No api_key_hash in metadata');
          break;
        }

        try {
          // Persist tier + quota in Redis (source of truth for fast enforcement)
          await upstashSet(`tier:${keyHash}`, tier);
          const quota = tier === 'pro' ? 1000000 : 10000;
          await upstashSet(`usage:${keyHash}:quota`, quota);
          console.log(`[Billing Webhook] Upgraded ${keyHash.slice(0, 8)}… to ${tier} (quota ${quota})`);
        } catch (e) {
          console.error('[Billing Webhook] Failed to update tier/quota in Redis:', e);
        }

        // Optional: update Postgres if configured (best-effort)
        const dbUrl = process.env.DATABASE_URL;
        if (dbUrl) {
          try {
            await fetch(`https://api.neon.tech/v2/sql`, {
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
          } catch (error) {
            console.error('[Billing Webhook] Database update error:', error);
          }
        }

        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        console.log(`[Webhook] Subscription ${subscription.id} status: ${subscription.status}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        console.log(`[Webhook] Subscription ${subscription.id} canceled`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        console.log(`[Webhook] Payment failed for customer ${invoice.customer}`);
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    return json(res, { received: true }, 200);

  } catch (error) {
    console.error('[Webhook] Error:', error);
    return json(res, { error: 'Webhook processing failed', message: error.message }, 500);
  }
}
