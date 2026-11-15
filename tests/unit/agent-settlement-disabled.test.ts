import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentSettlementService } from '../../src/services/AgentSettlementService.js';
import { BaseSettlementProvider } from '../../src/services/BaseSettlementProvider.js';

describe('experimental agent settlement safety', () => {
  const priorWallet = process.env.AGENTCACHE_MASTER_WALLET;
  const priorFetch = globalThis.fetch;

  afterEach(() => {
    if (priorWallet === undefined) delete process.env.AGENTCACHE_MASTER_WALLET;
    else process.env.AGENTCACHE_MASTER_WALLET = priorWallet;
    globalThis.fetch = priorFetch;
    vi.restoreAllMocks();
  });

  it('never treats a preauthorization-shaped token as a settled payment', async () => {
    const service = new AgentSettlementService();
    await expect(service.settle('0xarbitrary', 'agent-1', 10)).resolves.toEqual({
      success: false,
      authorized: false,
      error: 'x402_settlement_disabled',
    });
  });

  it('fails on-chain verification closed when the treasury address is missing', async () => {
    delete process.env.AGENTCACHE_MASTER_WALLET;
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as any;
    const provider = new BaseSettlementProvider();
    const verified = await provider.verifyOnChainSettlement(
      `0x${'a'.repeat(64)}`,
      `0x${'b'.repeat(40)}`,
      0.01,
    );
    expect(verified).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
