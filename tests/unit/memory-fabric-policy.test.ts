import { describe, expect, it } from 'vitest';
import { memoryFabricPolicyService } from '../../src/services/MemoryFabricPolicyService.js';

describe('MemoryFabricPolicyService', () => {
  it('clamps finance TTL to ontology freshness and returns audit mode', () => {
    const policy = memoryFabricPolicyService.resolve({
      sector: 'finance',
      verticalSku: 'finance-memory-fabric',
      requestedTtlSeconds: 7200,
      tierId: 'pro',
    });

    expect(policy.verticalSku).toBe('finance-memory-fabric');
    expect(policy.sectorId).toBe('finance');
    expect(policy.effectiveTtlSeconds).toBe(300);
    expect(policy.storageTier).toBe('hot');
    expect(policy.evidenceMode).toBe('audit');
    expect(policy.eligible).toBe(true);
  });

  it('falls back to enterprise copilot and respects shared namespace on free tier', () => {
    const policy = memoryFabricPolicyService.resolve({
      sector: 'general',
      requestedTtlSeconds: 120,
      tierId: 'free',
    });

    expect(policy.verticalSku).toBe('enterprise-copilot');
    expect(policy.namespaceMode).toBe('shared');
    expect(policy.eligible).toBe(false);
    expect(policy.recommendedTier).toBe('pro');
  });
});
