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
  // Deprecated: use /api/billing/webhook instead
  return res.status(410).json({ error: 'Deprecated endpoint. Use /api/billing/webhook' });
}
