import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  createSession: vi.fn(),
  retrieveSession: vi.fn(),
}));

vi.mock('../../lib/db.js', () => ({ query: mocks.query }));
vi.mock('stripe', () => ({
  default: class StripeMock {
    checkout = { sessions: { create: mocks.createSession, retrieve: mocks.retrieveSession } };
    constructor() {}
  },
}));

import handler from '../../api/audit/checkout.js';

function responseStub() {
  return {
    statusCode: 200,
    body: null as any,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
}

describe('Agent Run Risk & Savings Audit checkout', () => {
  const requestId = 'c6dd8464-8ca0-4bea-b748-ae880c584003';

  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_unit_test_only';
    delete process.env.VERCEL_ENV;
    mocks.query.mockReset();
    mocks.createSession.mockReset();
    mocks.retrieveSession.mockReset();
  });

  afterEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.VERCEL_ENV;
  });

  it('fails closed when production is configured with a test-mode Stripe key', async () => {
    process.env.VERCEL_ENV = 'production';
    const res = responseStub();
    await handler({ method: 'POST', body: { requestId } } as any, res as any);
    expect(res.statusCode).toBe(503);
    expect(res.body.error).toContain('not configured');
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it('fails closed when a preview deployment is configured with a live Stripe key', async () => {
    process.env.VERCEL_ENV = 'preview';
    process.env.STRIPE_SECRET_KEY = 'sk_live_never_use_in_preview';
    const res = responseStub();
    await handler({ method: 'POST', body: { requestId } } as any, res as any);
    expect(res.statusCode).toBe(503);
    expect(res.body.error).toContain('not configured');
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it('creates a fixed $750 card checkout only for a saved audit request', async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ id: requestId, status: 'open', config: {
        offer: 'agent-run-risk-savings-audit', email: 'buyer@example.test',
        scopeAcknowledged: true, scopeVersion: '2026-11-07-v2', scopeAcknowledgedAt: '2026-11-07T12:00:00.000Z',
      } }] })
      .mockResolvedValueOnce({ rowCount: 1 });
    mocks.createSession.mockResolvedValue({ id: 'cs_test_audit', url: 'https://checkout.stripe.test/session' });

    const res = responseStub();
    await handler({ method: 'POST', body: { requestId, amount: 1, email: 'attacker@example.test' } } as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body.checkoutUrl).toBe('https://checkout.stripe.test/session');
    const [params] = mocks.createSession.mock.calls[0];
    expect(params.line_items[0].price_data.unit_amount).toBe(75000);
    expect(params.customer_email).toBe('buyer@example.test');
    expect(params.payment_method_types).toBeUndefined();
    expect(params.metadata.service_request_id).toBe(requestId);
    expect(params.metadata.offer_id).toBe('agent-run-risk-savings-audit');
    expect(params.success_url).toContain('/agent-audit?payment=success');
    expect(mocks.createSession.mock.calls[0][1]).toEqual({ idempotencyKey: `agent-audit-${requestId}-initial` });
  });

  it('does not start checkout for an unrelated request', async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ id: requestId, status: 'open', config: { offer: 'other-offer', email: 'buyer@example.test' } }] });
    const res = responseStub();
    await handler({ method: 'POST', body: { requestId } } as any, res as any);
    expect(res.statusCode).toBe(404);
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it('requires a recorded current scope acknowledgment before checkout', async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ id: requestId, status: 'open', config: {
      offer: 'agent-run-risk-savings-audit', email: 'buyer@example.test',
    } }] });
    const res = responseStub();
    await handler({ method: 'POST', body: { requestId } } as any, res as any);
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toContain('acknowledge');
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it('does not open a second checkout while an asynchronous payment is processing', async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ id: requestId, status: 'payment_pending', config: {
        offer: 'agent-run-risk-savings-audit', email: 'buyer@example.test',
        scopeAcknowledged: true, scopeVersion: '2026-11-07-v2', scopeAcknowledgedAt: '2026-11-07T12:00:00.000Z',
        paymentState: 'pending', stripeCheckoutSessionId: 'cs_processing',
      } }] });
    mocks.retrieveSession.mockResolvedValue({ id: 'cs_processing', status: 'complete', payment_status: 'unpaid' });
    const res = responseStub();
    await handler({ method: 'POST', body: { requestId } } as any, res as any);
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toContain('still processing');
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it('uses a stable retry key when an earlier checkout expired', async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ id: requestId, status: 'checkout_expired', config: {
        offer: 'agent-run-risk-savings-audit', email: 'buyer@example.test',
        scopeAcknowledged: true, scopeVersion: '2026-11-07-v2', scopeAcknowledgedAt: '2026-11-07T12:00:00.000Z',
        paymentState: 'expired', stripeCheckoutSessionId: 'cs_expired_audit',
      } }] })
      .mockResolvedValueOnce({ rowCount: 1 });
    mocks.retrieveSession.mockResolvedValue({ id: 'cs_expired_audit', status: 'expired' });
    mocks.createSession.mockResolvedValue({ id: 'cs_retry_audit', url: 'https://checkout.stripe.test/retry' });
    const res = responseStub();
    await handler({ method: 'POST', body: { requestId } } as any, res as any);
    expect(res.statusCode).toBe(200);
    expect(mocks.createSession.mock.calls[0][1]).toEqual({ idempotencyKey: `agent-audit-${requestId}-retry-cs_expired_audit` });
  });

  it('prevents creating another charge when a retry finds an already-paid session', async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ id: requestId, status: 'payment_pending', config: {
        offer: 'agent-run-risk-savings-audit', email: 'buyer@example.test',
        scopeAcknowledged: true, scopeVersion: '2026-11-07-v2', scopeAcknowledgedAt: '2026-11-07T12:00:00.000Z',
        stripeCheckoutSessionId: 'cs_test_paid',
      } }] })
      .mockResolvedValueOnce({ rowCount: 1 });
    mocks.retrieveSession.mockResolvedValue({
      id: 'cs_test_paid',
      status: 'complete',
      mode: 'payment',
      payment_status: 'paid',
      amount_total: 75000,
      currency: 'usd',
      payment_intent: 'pi_test_paid',
      metadata: { type: 'agent_run_audit', offer_id: 'agent-run-risk-savings-audit', service_request_id: requestId },
    });

    const res = responseStub();
    await handler({ method: 'POST', body: { requestId } } as any, res as any);

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toContain('already paid');
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it('reconciles a paid audit from the authoritative Stripe session', async () => {
    mocks.retrieveSession.mockResolvedValue({
      id: 'cs_test_audit',
      mode: 'payment',
      payment_status: 'paid',
      amount_total: 75000,
      currency: 'usd',
      payment_intent: 'pi_test_audit',
      metadata: { type: 'agent_run_audit', offer_id: 'agent-run-risk-savings-audit', service_request_id: requestId },
    });
    mocks.query.mockResolvedValueOnce({ rowCount: 1 });
    const res = responseStub();
    await handler({ method: 'GET', query: { session_id: 'cs_test_audit' } } as any, res as any);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ paid: true, requestId });
    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining("status = 'payment_received'"), expect.any(Array));
  });

  it('reports an unknown Stripe session without claiming an audit request was saved', async () => {
    mocks.retrieveSession.mockRejectedValue({ type: 'StripeInvalidRequestError', code: 'resource_missing' });
    const res = responseStub();
    await handler({ method: 'GET', query: { session_id: 'cs_invalid' } } as any, res as any);
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toContain('Payment session not found');
    expect(res.body.error).not.toContain('request is still saved');
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it('returns a retryable status when Stripe cannot verify a session', async () => {
    mocks.retrieveSession.mockRejectedValue(new Error('Stripe network timeout'));
    const res = responseStub();
    await handler({ method: 'GET', query: { session_id: 'cs_test_audit' } } as any, res as any);
    expect(res.statusCode).toBe(503);
    expect(res.body.error).toContain('could not verify payment status');
    expect(res.body.error).toContain('do not start another checkout');
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
