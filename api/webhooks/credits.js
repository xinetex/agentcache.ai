/**
 * Stripe Webhook Handler for Credits
 * AgentCache.ai - Top-Off Billing
 * 
 * Handles:
 *   - checkout.session.completed (credit purchases)
 *   - payment_intent.succeeded (auto top-off)
 *   - payment_intent.payment_failed (notify user)
 */

import Stripe from 'stripe';
import { neon } from '@neondatabase/serverless';
import { addCreditsToUser } from '../credits.js';
import { CREDIT_PACKAGES } from '../../src/config/credits.js';

export const config = { runtime: 'nodejs' };

const sql = neon(process.env.DATABASE_URL);
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY) 
  : null;

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_CREDITS;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!stripe || !webhookSecret) {
    console.error('Stripe not configured for credits webhook');
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  let event;

  try {
    // Verify webhook signature
    const signature = req.headers['stripe-signature'];
    const rawBody = req.body; // Must be raw body, not parsed JSON
    
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  try {
    switch (event.type) {
      // ============================================
      // Credit Purchase Completed (Checkout)
      // ============================================
      case 'checkout.session.completed': {
        const session = event.data.object;
        
        // Only handle credit purchases
        if (session.metadata?.type !== 'credit_purchase') {
          console.log('Ignoring non-credit checkout session');
          break;
        }

        const userId = session.metadata.userId;
        const packageId = session.metadata.packageId;
        const pkg = CREDIT_PACKAGES[packageId];

        if (!userId || !pkg) {
          console.error('Missing userId or invalid package in checkout session');
          break;
        }

        // Check if already processed (idempotency)
        const [existing] = await sql`
          SELECT id FROM credit_transactions 
          WHERE stripe_checkout_session_id = ${session.id}
        `;

        if (existing) {
          console.log(`Checkout session ${session.id} already processed`);
          break;
        }

        // Add credits to user
        const newBalance = await addCreditsToUser(userId, pkg.credits, {
          type: 'purchase',
          packageId,
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: session.payment_intent,
          description: `Purchased ${pkg.credits} credits (${pkg.priceDisplay})`,
        });

        console.log(`[Credits] Added ${pkg.credits} credits to user ${userId}. New balance: ${newBalance}`);

        // Update Stripe customer ID if not set
        if (session.customer) {
          await sql`
            UPDATE users 
            SET stripe_customer_id = ${session.customer}
            WHERE id = ${userId} AND stripe_customer_id IS NULL
          `;
        }

        break;
      }

      // ============================================
      // Auto Top-Off Payment Succeeded
      // ============================================
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;

        // Only handle auto top-off payments
        if (paymentIntent.metadata?.type !== 'auto_topoff') {
          break;
        }

        const userId = paymentIntent.metadata.userId;
        const credits = parseInt(paymentIntent.metadata.credits);

        if (!userId || !credits) {
          console.error('Missing metadata in auto top-off payment intent');
          break;
        }

        // Check if already processed
        const [existing] = await sql`
          SELECT id FROM credit_transactions 
          WHERE stripe_payment_intent_id = ${paymentIntent.id}
        `;

        if (existing) {
          console.log(`Payment intent ${paymentIntent.id} already processed`);
          break;
        }

        // Credits should already be added by the auto-topoff trigger
        // This is a confirmation/backup
        console.log(`[Auto Top-Off] Confirmed: ${credits} credits for user ${userId}`);

        break;
      }

      // ============================================
      // Payment Failed (notify user, disable auto top-off)
      // ============================================
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;

        if (paymentIntent.metadata?.type === 'auto_topoff') {
          const userId = paymentIntent.metadata.userId;
          const error = paymentIntent.last_payment_error?.message || 'Unknown error';

          console.error(`[Auto Top-Off] Payment failed for user ${userId}: ${error}`);

          // Disable auto top-off
          await sql`
            UPDATE auto_topoff_settings 
            SET enabled = false, updated_at = NOW()
            WHERE user_id = ${userId}
          `;

          // TODO: Send notification email to user
          // await sendEmail(userId, 'auto_topoff_failed', { error });
        }

        break;
      }

      // ============================================
      // Customer payment method updated
      // ============================================
      case 'customer.source.updated':
      case 'payment_method.attached': {
        // Could update auto top-off payment method here if needed
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('Webhook handler error:', error);
    return res.status(500).json({ error: 'Webhook handler error' });
  }
}
