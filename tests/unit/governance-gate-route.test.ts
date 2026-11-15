import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  policy: { budgetUsd: 0.05, quotaRequests: 0, warnRatio: 0.8, killSwitch: false, blockOnAnomaly: false, anomalySigma: 3 },
  usage: { spentUsd: 0, usedRequests: 0, series: [] as number[] },
  validateApiKey: vi.fn(async () => ({ organizationId: 'org-test', organizationSlug: 'test-org' })),
  loadPolicy: vi.fn(async () => mocks.policy),
  loadUsage: vi.fn(async () => mocks.usage),
}));

vi.mock('../../lib/api-key-middleware.js', () => ({ validateApiKey: mocks.validateApiKey }));
vi.mock('../../lib/governance-data.js', () => ({
  loadPolicy: mocks.loadPolicy,
  loadUsage: mocks.loadUsage,
}));
vi.mock('../../lib/ensure-schema.js', () => ({ ensureGovernanceSchema: vi.fn(async () => true) }));
vi.mock('../../lib/neon.js', () => ({ sql: vi.fn() }));

import { governanceGate } from '../../src/api/governance-gate.js';

const app = new Hono();
app.post('/gate', governanceGate);

describe('governance gate route', () => {
  beforeEach(() => {
    mocks.policy = { budgetUsd: 0.05, quotaRequests: 0, warnRatio: 0.8, killSwitch: false, blockOnAnomaly: false, anomalySigma: 3 };
    mocks.usage = { spentUsd: 0, usedRequests: 0, series: [] };
    mocks.validateApiKey.mockClear();
    mocks.loadPolicy.mockClear();
    mocks.loadUsage.mockClear();
  });

  async function call(body: Record<string, unknown>) {
    const response = await app.request('/gate', {
      method: 'POST',
      headers: { Authorization: 'Bearer ac_test_key', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { response, payload: await response.json() as any };
  }

  it('allows an approved model call and identifies the organization', async () => {
    const { response, payload } = await call({ model: 'gpt-5.2', inputTokens: 1000, outputTokens: 1000 });

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(payload).toMatchObject({ organizationSlug: 'test-org', model: 'gpt-5.2', priced: true, allow: true, severity: 'ok' });
    expect(payload.estCostUsd).toBeGreaterThan(0);
    expect(mocks.loadPolicy).toHaveBeenCalledWith(expect.anything(), 'org-test');
  });

  it('blocks a call projected to exceed the configured budget', async () => {
    mocks.policy.budgetUsd = 0.005;
    const { response, payload } = await call({ model: 'gpt-5.2', inputTokens: 1000, outputTokens: 1000 });

    expect(response.status).toBe(200);
    expect(payload.allow).toBe(false);
    expect(payload.severity).toBe('block');
    expect(payload.reasons).toContain('budget exceeded: $0 + est would pass $0.005');
  });

  it('enforces sub-cent cost at full precision while keeping the response rounded', async () => {
    mocks.policy.budgetUsd = 0.001;
    const { response, payload } = await call({ model: 'gpt-5.2', inputTokens: 1000, outputTokens: 0 });

    expect(response.status).toBe(200);
    expect(payload.estCostUsd).toBe(0.00175);
    expect(payload.allow).toBe(false);
    expect(payload.severity).toBe('block');
  });

  it('requires an AgentCache API key', async () => {
    const response = await app.request('/gate', { method: 'POST', body: '{}' });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: 'Unauthorized' });
    expect(mocks.validateApiKey).not.toHaveBeenCalled();
  });
});
