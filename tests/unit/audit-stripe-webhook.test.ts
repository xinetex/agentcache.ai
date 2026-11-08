import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Readable } from 'node:stream';

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  transaction: vi.fn(),
  query: vi.fn(),
}));

vi.mock('stripe', () => ({
  default: class StripeMock {
    webhooks = { constructEvent: mocks.constructEvent };
    constructor() {}
  },
}));
vi.mock('../../lib/db.js', () => ({ transaction: mocks.transaction }));
vi.mock('../../api/credits.js', () => ({ addCreditsToUser: vi.fn() }));

import handler from '../../api/billing/webhook.js';

function responseStub() {
  return {
    statusCode: 200,
    body: null as any,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
}

function stripeRequest() {
  const request = Readable.from([Buffer.from('verified stripe event')]) as any;
  request.method = 'POST';
  request.headers = { 'stripe-signature': 'test-signature' };
  return request;
}

describe('audit Stripe webhook reconciliation', () => {
  const requestId = 'c6dd8464-8ca0-4bea-b748-ae880c584003';

  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_unit_test_only';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_unit_test_only';
    delete process.env.VERCEL_ENV;
    mocks.constructEvent.mockReset();
    mocks.query.mockReset().mockResolvedValue({ rowCount: 1 });
    mocks.transaction.mockReset().mockImplementation(async (callback) => callback({ query: mocks.query }));
  });

  afterEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.VERCEL_ENV;
  });

  it('records payment only from a signature-verified exact-price audit checkout event', async () => {
    mocks.constructEvent.mockReturnValue({
      id: 'evt_test_audit',
      type: 'checkout.session.completed',
      data: { object: {
        id: 'cs_test_audit',
        mode: 'payment',
        payment_status: 'paid',
        amount_total: 75000,
        currency: 'usd',
        livemode: false,
        payment_intent: 'pi_test_audit',
        metadata: { type: 'agent_run_audit', offer_id: 'agent-run-risk-savings-audit', service_request_id: requestId },
      } },
    });

    const res = responseStub();
    await handler(stripeRequest(), res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect(mocks.constructEvent).toHaveBeenCalledWith(Buffer.from('verified stripe event'), 'test-signature', 'whsec_unit_test_only');
    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining("status = 'payment_received'"), [
      requestId,
      expect.any(String),
      'agent-run-risk-savings-audit',
    ]);
  });

  it('does not reconcile a payment with a mismatched amount', async () => {
    mocks.constructEvent.mockReturnValue({
      id: 'evt_test_wrong_amount',
      type: 'checkout.session.completed',
      data: { object: {
        id: 'cs_test_wrong_amount',
        mode: 'payment',
        payment_status: 'paid',
        amount_total: 10,
        currency: 'usd',
        livemode: false,
        metadata: { type: 'agent_run_audit', offer_id: 'agent-run-risk-savings-audit', service_request_id: requestId },
      } },
    });

    const res = responseStub();
    await handler(stripeRequest(), res as any);
    expect(res.statusCode).toBe(200);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it('reconciles delayed-method payments after Stripe confirms asynchronous success', async () => {
    mocks.constructEvent.mockReturnValue({
      id: 'evt_test_async_audit',
      type: 'checkout.session.async_payment_succeeded',
      data: { object: {
        id: 'cs_test_async_audit',
        mode: 'payment',
        payment_status: 'paid',
        amount_total: 75000,
        currency: 'usd',
        livemode: false,
        payment_intent: 'pi_test_async_audit',
        metadata: { type: 'agent_run_audit', offer_id: 'agent-run-risk-savings-audit', service_request_id: requestId },
      } },
    });
    const res = responseStub();
    await handler(stripeRequest(), res as any);
    expect(res.statusCode).toBe(200);
    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining("status = 'payment_received'"), [
      requestId,
      expect.any(String),
      'agent-run-risk-savings-audit',
    ]);
  });

  it('records asynchronous payment failure against the matching pending session', async () => {
    mocks.constructEvent.mockReturnValue({
      id: 'evt_test_async_failed',
      type: 'checkout.session.async_payment_failed',
      data: { object: {
        id: 'cs_test_async_failed',
        mode: 'payment',
        amount_total: 75000,
        currency: 'usd',
        livemode: false,
        metadata: { type: 'agent_run_audit', offer_id: 'agent-run-risk-savings-audit', service_request_id: requestId },
      } },
    });
    const res = responseStub();
    await handler(stripeRequest(), res as any);
    expect(res.statusCode).toBe(200);
    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining("config->>'paymentState' = 'pending'"), [
      requestId,
      'payment_failed',
      expect.any(String),
      'agent-run-risk-savings-audit',
      'cs_test_async_failed',
    ]);
  });
});
