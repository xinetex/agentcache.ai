import { describe, expect, it } from 'vitest';
import { executionStorageUnavailable } from '../../src/middleware/auth.js';

describe('governed execution storage readiness', () => {
  it('fails closed for execution records and provider calls backed only by mock storage', () => {
    expect(executionStorageUnavailable('/api/execution/runs/run-1/invoke', true, false)).toBe(true);
    expect(executionStorageUnavailable('/api/execution/connections', true, false)).toBe(true);
    expect(executionStorageUnavailable('/api/execution/admin/gates/gate-1/approve', true, false)).toBe(true);
  });

  it('keeps public tool discovery and test fixtures available', () => {
    expect(executionStorageUnavailable('/api/execution/tools', true, false)).toBe(false);
    expect(executionStorageUnavailable('/api/execution/runs/run-1/invoke', true, true)).toBe(false);
  });

  it('allows execution routes when the durable database is configured', () => {
    expect(executionStorageUnavailable('/api/execution/runs/run-1/invoke', false, false)).toBe(false);
  });
});
