import { afterEach, describe, expect, it, vi } from 'vitest';
import { ControlPlaneTools } from '../../packages/agentcache-mcp/dist/tools/controlplane.js';

const context = (apiKey = 'ac_test_member_key') => ({ apiKey } as any);

describe('published agentcache-mcp governed execution tools', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('advertises the Jetty pilot path without exposing a gate-approval tool', () => {
    const names = ControlPlaneTools.tools.map((tool) => tool.name);
    expect(names).toContain('agentcache_execution_tools');
    expect(names).toContain('agentcache_execution_connect');
    expect(names).toContain('agentcache_execution_start');
    expect(names).toContain('agentcache_execution_invoke_jetty_summary');
    expect(names).toContain('agentcache_execution_invocation_history');
    expect(names).not.toContain('agentcache_execution_approve_gate');
    expect(Object.keys(ControlPlaneTools.handlers)).toEqual(expect.arrayContaining(names));
  });

  it('invokes the fixed Jetty adapter with the configured API key and idempotency key', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, invocation: { status: 'completed' } }) });
    vi.stubGlobal('fetch', fetchMock);
    const result = await ControlPlaneTools.handlers.agentcache_execution_invoke_jetty_summary({
      runId: 'run/with space', connectionId: 'connection-1', idempotencyKey: 'retry-key-00000001',
    }, context());

    expect(fetchMock).toHaveBeenCalledWith(
      'https://agentcache.ai/api/execution/runs/run%2Fwith%20space/invoke',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer ac_test_member_key', 'X-API-Key': 'ac_test_member_key' }),
        body: JSON.stringify({ tool: 'jetty.storage.summary', connectionId: 'connection-1', idempotencyKey: 'retry-key-00000001' }),
      }),
    );
    expect(result.content[0].text).toContain('completed');
  });

  it('does not substitute a demo credential when none is configured', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(ControlPlaneTools.handlers.agentcache_execution_tools({}, context('')))
      .rejects.toThrow('Set AGENTCACHE_API_KEY');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('phase advancement calls the run API and cannot approve a gate', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    vi.stubGlobal('fetch', fetchMock);
    await ControlPlaneTools.handlers.agentcache_execution_advance_phase({ runId: 'run-1', phase: 'gate' }, context());
    expect(fetchMock).toHaveBeenCalledWith('https://agentcache.ai/api/execution/runs/run-1/phase', expect.objectContaining({ method: 'POST' }));
    expect(fetchMock.mock.calls[0][0]).not.toContain('/approve');
    expect(ControlPlaneTools.tools.find((tool) => tool.name === 'agentcache_execution_advance_phase')?.description)
      .toContain('A different owner or admin member of the same organization');
  });
});
