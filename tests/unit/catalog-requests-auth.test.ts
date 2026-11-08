import { afterEach, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import catalogRouter from '../../src/api/catalog.js';

const app = new Hono().route('/api/catalog', catalogRouter);

describe('catalog request privacy', () => {
  afterEach(() => {
    delete process.env.ADMIN_TOKEN;
  });

  it('does not expose service-request details without the admin token', async () => {
    process.env.ADMIN_TOKEN = 'test-admin-token';
    const response = await app.request('/api/catalog/requests', { method: 'GET' });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: 'Unauthorized: Admin access required' });
  });

  it('fails closed when admin access is not configured', async () => {
    delete process.env.ADMIN_TOKEN;
    const response = await app.request('/api/catalog/requests', { method: 'GET' });
    expect(response.status).toBe(503);
  });

  it('accepts the public fixed-scope audit intake and returns a saved request ID', async () => {
    const response = await app.request('/api/catalog/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceId: 'custom',
        title: 'Agent Run Risk & Savings Audit: Example Co',
        description: 'Email: buyer@example.test',
        config: {
          offer: 'agent-run-risk-savings-audit',
          email: 'buyer@example.test',
          scopeAcknowledged: true,
          scopeVersion: '2026-11-07-v2',
        },
      }),
    });
    const result = await response.json();
    expect(response.status).toBe(201);
    expect(result).toMatchObject({ success: true, status: 'open' });
    expect(result.requestId).toBeTruthy();
  });

  it('rejects audit intake unless the current paid scope is acknowledged', async () => {
    const response = await app.request('/api/catalog/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceId: 'custom',
        title: 'Agent Run Risk & Savings Audit: Example Co',
        config: { offer: 'agent-run-risk-savings-audit', email: 'buyer@example.test' },
      }),
    });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining('acknowledge') });
  });
});
