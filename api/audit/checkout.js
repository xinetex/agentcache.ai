import Stripe from 'stripe';
import { query } from '../../lib/db.js';
import { AGENT_RUN_AUDIT } from '../../src/config/agentRunAudit.js';

export const config = { runtime: 'nodejs' };

const AUDIT_PRICE_CENTS = AGENT_RUN_AUDIT.priceCents;
const AUDIT_OFFER_ID = AGENT_RUN_AUDIT.id;

function json(res, body, status = 200) {
  return res.status(status).json(body);
}

function isLiveDeployment() {
  return process.env.VERCEL_ENV === 'production'
    || (process.env.NODE_ENV === 'production' && !process.env.VERCEL_ENV);
}

function getStripe() {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return null;
  const keyMatchesEnvironment = isLiveDeployment()
    ? /^(sk_live_|rk_live_)/.test(secret)
    : /^(sk_test_|rk_test_)/.test(secret);
  if (!keyMatchesEnvironment) return null;
  return new Stripe(secret, { apiVersion: '2026-03-25.dahlia' });
}

function getBaseUrl() {
  const configured = process.env.PUBLIC_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://agentcache.ai');
  return configured.replace(/\/$/, '');
}

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isAuditCheckoutSession(session) {
  const liveDeployment = isLiveDeployment();
  return session?.metadata?.offer_id === AUDIT_OFFER_ID
    && session?.metadata?.type === 'agent_run_audit'
    && session.mode === 'payment'
    && session.amount_total === AUDIT_PRICE_CENTS
    && session.currency === AGENT_RUN_AUDIT.currency
    && (!liveDeployment || session.livemode === true);
}

function isPaidAuditCheckoutSession(session) {
  return isAuditCheckoutSession(session) && session.payment_status === 'paid';
}

async function markAuditPaid(session, eventId = null) {
  const requestId = session.metadata?.service_request_id;
  if (!isUuid(requestId) || session.metadata?.offer_id !== AUDIT_OFFER_ID) {
    throw new Error('Paid audit checkout is missing valid request metadata.');
  }

  const updated = await query(`
    UPDATE service_requests
    SET status = 'payment_received',
        config = COALESCE(config, '{}'::jsonb) || $2::jsonb,
        updated_at = NOW()
    WHERE id = $1
      AND config->>'offer' = $3
  `, [requestId, JSON.stringify({
    paymentState: 'paid',
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || null,
    stripeEventId: eventId,
    paidAt: new Date().toISOString(),
  }), AUDIT_OFFER_ID]);
  if (updated.rowCount !== 1) throw new Error('The paid audit request could not be reconciled.');
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return json(res, { error: 'Method not allowed' }, 405);
  }

  const stripe = getStripe();
  if (!stripe) {
    return json(res, { error: 'Secure checkout is not configured yet. Your request has not been charged.' }, 503);
  }

  try {
    if (req.method === 'GET') {
      const sessionId = Array.isArray(req.query?.session_id) ? req.query.session_id[0] : req.query?.session_id;
      if (typeof sessionId !== 'string' || !sessionId.startsWith('cs_')) {
        return json(res, { error: 'A valid checkout session is required.' }, 400);
      }

      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (!isPaidAuditCheckoutSession(session)) return json(res, { paid: false }, 200);
      await markAuditPaid(session);
      return json(res, { paid: true, requestId: session.metadata.service_request_id }, 200);
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const requestId = body.requestId;
    if (!isUuid(requestId)) return json(res, { error: 'A valid audit request ID is required.' }, 400);

    const result = await query('SELECT id, config, status FROM service_requests WHERE id = $1 LIMIT 1', [requestId]);
    const request = result.rows?.[0];
    const intake = request?.config || {};
    const emailIsValid = typeof intake.email === 'string'
      && intake.email.length <= 254
      && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(intake.email);
    const scopeAcknowledged = intake.scopeAcknowledged === true
      && intake.scopeVersion === AGENT_RUN_AUDIT.scopeVersion
      && typeof intake.scopeAcknowledgedAt === 'string';
    if (!request || intake.offer !== AUDIT_OFFER_ID || !emailIsValid) {
      return json(res, { error: 'Audit request not found. Submit the fit form first.' }, 404);
    }
    if (!scopeAcknowledged) {
      return json(res, { error: 'Please resubmit the audit request and acknowledge the current scope before checkout.' }, 409);
    }
    if (request.status === 'payment_received' || intake.paymentState === 'paid') {
      return json(res, { error: 'This audit request is already paid.' }, 409);
    }

    const existingId = intake.stripeCheckoutSessionId;
    if (existingId) {
      let existing;
      try {
        existing = await stripe.checkout.sessions.retrieve(existingId);
      } catch {
        return json(res, { error: 'The existing checkout could not be checked safely. Please retry in a moment.' }, 503);
      }
      if (isAuditCheckoutSession(existing) && existing.metadata?.service_request_id === requestId
        && existing.status === 'open' && existing.url) {
        return json(res, { checkoutUrl: existing.url, sessionId: existing.id }, 200);
      }
      if (isPaidAuditCheckoutSession(existing) && existing.metadata?.service_request_id === requestId) {
        await markAuditPaid(existing);
        return json(res, { error: 'This audit request is already paid.' }, 409);
      }
      if (existing.status === 'complete' && intake.paymentState === 'pending') {
        return json(res, { error: 'Payment is still processing. Please do not start another checkout.' }, 409);
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: AGENT_RUN_AUDIT.currency,
          unit_amount: AUDIT_PRICE_CENTS,
          product_data: {
            name: AGENT_RUN_AUDIT.name,
            description: `One agent workflow, up to ${AGENT_RUN_AUDIT.maxRunRecords} redacted run records, a prioritized findings report, and a ${AGENT_RUN_AUDIT.readoutMinutes}-minute readout within ${AGENT_RUN_AUDIT.deliveryBusinessDays} business days after kickoff and acceptance of complete inputs.`,
          },
        },
        quantity: 1,
      }],
      customer_email: intake.email,
      client_reference_id: requestId,
      metadata: { type: 'agent_run_audit', offer_id: AUDIT_OFFER_ID, service_request_id: requestId },
      payment_intent_data: { metadata: { offer_id: AUDIT_OFFER_ID, service_request_id: requestId } },
      success_url: `${getBaseUrl()}/agent-audit?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${getBaseUrl()}/agent-audit?payment=cancelled&request_id=${encodeURIComponent(requestId)}#request`,
    }, { idempotencyKey: existingId
      ? `agent-audit-${requestId}-retry-${existingId}`
      : `agent-audit-${requestId}-initial` });
    if (!session.url) throw new Error('Stripe did not return a Checkout URL.');

    await query(`
      UPDATE service_requests
      SET status = 'payment_pending',
          config = COALESCE(config, '{}'::jsonb) || $2::jsonb,
          updated_at = NOW()
      WHERE id = $1 AND config->>'offer' = $3
    `, [requestId, JSON.stringify({ paymentState: 'pending', stripeCheckoutSessionId: session.id }), AUDIT_OFFER_ID]);

    return json(res, { checkoutUrl: session.url, sessionId: session.id }, 200);
  } catch (error) {
    console.error('[Audit Checkout] Request failed:', error?.message || error);
    return json(res, { error: 'Checkout could not be completed right now. Your audit request is still saved.' }, 500);
  }
}
