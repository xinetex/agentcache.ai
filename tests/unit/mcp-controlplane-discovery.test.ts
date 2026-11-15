import { afterEach, describe, expect, it, vi } from 'vitest';
import { ControlPlaneTools } from '../../src/mcp/tools/controlplane.js';

describe('MCP governed tool discovery', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns the authoritative API catalog, including tool safety metadata', async () => {
    const catalog = {
      success: true,
      tools: [{
        name: 'jetty.storage.summary',
        toolVersion: '1.0.0',
        inputSchemaVersion: '1.0.0',
        risk: 'low',
        effect: 'read_only',
        requiredConnection: { provider: 'jettythunder', scopes: ['storage.read', 'metadata.read'] },
        timeoutMs: 8000,
        retrySafety: 'read_only_idempotent; inspect the invocation record before retrying an incomplete call',
      }],
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(catalog), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const handler = ControlPlaneTools.handlers.agentcache_execution_tools;
    const result = await handler({}, { request: null, rateLimiter: null, auditLogger: null, apiKey: 'ac_test_key' });

    expect(fetchMock).toHaveBeenCalledWith('https://agentcache.ai/api/execution/tools', expect.objectContaining({
      method: 'GET',
      headers: expect.objectContaining({ Authorization: 'Bearer ac_test_key' }),
    }));
    expect(JSON.parse(result.content[0].text)).toEqual(catalog);
  });

  it('wires MCP context-pack discovery, creation, and retrieval to owned API routes', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, packs: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, pack: { id: 'ctx_1' } }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, pack: { id: 'ctx_1' }, latestVersion: { id: 'ctxv_1' } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const context = { request: null, rateLimiter: null, auditLogger: null, apiKey: 'ac_test_key' };

    const list = await ControlPlaneTools.handlers.agentcache_execution_context_packs({ limit: 500 }, context);
    const created = await ControlPlaneTools.handlers.agentcache_execution_create_context_pack({
      name: 'Read-only storage summary',
      objective: 'Read aggregate storage usage.',
      sectorHint: 'general',
      tools: ['jetty.storage.summary'],
      policyProfile: { allowedActions: ['jetty.storage.summary'] },
      workflowPhases: ['draft', 'gate', 'finalize'],
      reviewerRoles: [],
    }, context);
    const retrieved = await ControlPlaneTools.handlers.agentcache_execution_context_pack({ contextPackId: 'ctx/1' }, context);

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://agentcache.ai/api/execution/context-packs?limit=100',
      'https://agentcache.ai/api/execution/context-packs',
      'https://agentcache.ai/api/execution/context-packs/ctx%2F1',
    ]);
    expect(JSON.parse(list.content[0].text)).toEqual({ success: true, packs: [] });
    expect(JSON.parse(created.content[0].text).pack.id).toBe('ctx_1');
    expect(JSON.parse(retrieved.content[0].text).latestVersion.id).toBe('ctxv_1');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string)).toMatchObject({
      sectorHint: 'general', workflowPhases: ['draft', 'gate', 'finalize'], reviewerRoles: [],
    });
    expect(fetchMock.mock.calls.every(([, options]) => options.headers['Authorization'] === 'Bearer ac_test_key')).toBe(true);
  });

  it('lets the authenticated MCP principal advance its run without gaining gate approval authority', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      run: { id: 'run_1', currentPhase: 'gate', gateStatus: 'pending' },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await ControlPlaneTools.handlers.agentcache_execution_advance_phase(
      { runId: 'run/1', phase: 'gate' },
      { request: null, rateLimiter: null, auditLogger: null, apiKey: 'ac_test_key' },
    );

    expect(fetchMock).toHaveBeenCalledWith('https://agentcache.ai/api/execution/runs/run%2F1/phase', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer ac_test_key' }),
      body: JSON.stringify({ phase: 'gate' }),
    }));
    expect(JSON.parse(result.content[0].text).run).toMatchObject({ currentPhase: 'gate', gateStatus: 'pending' });
    expect(ControlPlaneTools.tools.find((tool) => tool.name === 'agentcache_execution_advance_phase')?.description)
      .toContain('a different owner or admin member of the same organization');
  });

  it('makes connection ownership and API-key requirements explicit in MCP discovery', () => {
    const connectionTool = ControlPlaneTools.tools.find((tool) => tool.name === 'agentcache_execution_connect');
    expect(connectionTool?.description).toContain('Requires a user or organization AgentCache API key');
    expect(connectionTool?.description).toContain('you own');
    expect(ControlPlaneTools.tools.find((tool) => tool.name === 'agentcache_execution_disconnect')?.description)
      .toContain('owned by this user or organization API key');
  });
});
