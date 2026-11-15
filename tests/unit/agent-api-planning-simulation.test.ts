import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  send: vi.fn(async () => ({ ids: ['event-test'] })),
  validateApiKey: vi.fn(async () => ({ organizationId: 'org-test', allowedNamespaces: ['org:test'] })),
}));

vi.mock('../../src/inngest/client.js', () => ({ inngest: { send: mocks.send } }));
vi.mock('../../lib/api-key-middleware.js', () => ({ validateApiKey: mocks.validateApiKey }));

let app: Hono;
const previousDatabaseUrl = process.env.DATABASE_URL;

beforeAll(async () => {
  process.env.DATABASE_URL = '';
  ({ default: app } = await import('../../src/api/agent.js'));
});

afterAll(() => {
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
});

describe('legacy planning simulation API', () => {
  it('labels dispatched runs as simulations with no provider calls', async () => {
    mocks.send.mockClear();
    const response = await app.request('/dispatch', {
      method: 'POST',
      headers: { Authorization: 'Bearer ac_test_key', 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: 'test-agent', steps: [] }),
    });
    const payload = await response.json() as any;

    expect(response.status).toBe(202);
    expect(payload).toMatchObject({
      mode: 'planning_simulation',
      providerCallsEnabled: false,
      costBasis: 'caller_declared_estimates',
      savingsBasis: 'caller_declared_cache_fields',
    });
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it('rejects webhook URLs before storing credentials in a background event', async () => {
    mocks.send.mockClear();
    const response = await app.request('/dispatch', {
      method: 'POST',
      headers: { Authorization: 'Bearer ac_test_key', 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: 'test-agent', webhookUrl: 'https://hooks.slack.com/services/secret' }),
    });
    const payload = await response.json() as any;

    expect(response.status).toBe(400);
    expect(payload.code).toBe('notification_webhook_connection_required');
    expect(JSON.stringify(payload)).not.toContain('/services/secret');
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
