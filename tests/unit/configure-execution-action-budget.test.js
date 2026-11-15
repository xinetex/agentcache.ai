import { describe, expect, it, vi } from 'vitest';
import { configureExecutionActionBudget } from '../../scripts/configure-execution-action-budget.mjs';

const organizationId = '123e4567-e89b-42d3-a456-426614174000';
const env = {
  AGENTCACHE_BASE_URL: 'https://preview.agentcache.ai/',
  PILOT_ORGANIZATION_ID: organizationId,
  PILOT_ACTION_LIMIT: '1000',
  PILOT_ACTION_PERIOD_START: '2026-11-15T00:00:00.000Z',
  PILOT_ACTION_PERIOD_END: '2027-02-13T00:00:00.000Z',
  ADMIN_TOKEN: 'must-not-appear-in-output',
};

function jsonResponse(status, body) {
  return { status, json: async () => body };
}

describe('execution action-budget operator command', () => {
  it('defaults to a read-only dry run', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(404, { error: 'Action budget not found.' }));
    const result = await configureExecutionActionBudget({ env, args: [], fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.applied).toBe(false);
    expect(result.budget).toMatchObject({ organizationId, actionLimit: 1000 });
    expect(JSON.stringify(result)).not.toContain(env.ADMIN_TOKEN);
  });

  it('refuses to reset an existing budget window without explicit confirmation', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { budget: {
      periodStart: '2026-10-01T00:00:00.000Z', periodEnd: '2026-11-01T00:00:00.000Z',
    } }));

    await expect(configureExecutionActionBudget({ env, args: ['--apply'], fetchImpl }))
      .rejects.toThrow('would reset the action counter');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('writes and reads back the requested cap without exposing the admin token', async () => {
    const budget = {
      actionLimit: 1000, reservedCount: 12,
      periodStart: env.PILOT_ACTION_PERIOD_START, periodEnd: env.PILOT_ACTION_PERIOD_END,
    };
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse(404, {}))
      .mockResolvedValueOnce(jsonResponse(200, { success: true, budget }))
      .mockResolvedValueOnce(jsonResponse(200, { success: true, budget }));

    const result = await configureExecutionActionBudget({ env, args: ['--apply'], fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(fetchImpl.mock.calls[1][1]).toMatchObject({ method: 'PUT', headers: { 'X-Admin-Token': env.ADMIN_TOKEN } });
    expect(result).toMatchObject({ applied: true, budget: { actionLimit: 1000, reservedCount: 12 } });
    expect(JSON.stringify(result)).not.toContain(env.ADMIN_TOKEN);
  });

  it('requires HTTPS outside loopback and UTC bounded windows', async () => {
    const fetchImpl = vi.fn();
    await expect(configureExecutionActionBudget({ env: { ...env, AGENTCACHE_BASE_URL: 'http://preview.agentcache.ai' }, fetchImpl }))
      .rejects.toThrow('Use HTTPS');
    await expect(configureExecutionActionBudget({ env: { ...env, PILOT_ACTION_PERIOD_START: '2026-11-15T00:00:00-05:00' }, fetchImpl }))
      .rejects.toThrow('UTC ISO timestamps');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
