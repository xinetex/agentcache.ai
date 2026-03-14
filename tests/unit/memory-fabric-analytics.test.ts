import { describe, expect, it } from 'vitest';
import { memoryFabricAnalyticsService } from '../../src/services/MemoryFabricAnalyticsService.js';
import { memoryFabricPolicyService } from '../../src/services/MemoryFabricPolicyService.js';

describe('MemoryFabricAnalyticsService', () => {
  it('records ROI metrics for reads, writes, and ttl clamp events', async () => {
    const policy = memoryFabricPolicyService.resolve({
      sector: 'finance',
      verticalSku: 'finance-memory-fabric',
      requestedTtlSeconds: 7200,
      tierId: 'pro',
    });

    await memoryFabricAnalyticsService.recordOperation({
      policy,
      operation: 'write',
      promptText: 'compute intraday risk for AAPL position delta',
      responseText: 'risk snapshot stored',
    });

    await memoryFabricAnalyticsService.recordOperation({
      policy,
      operation: 'read',
      hit: true,
      promptText: 'compute intraday risk for AAPL position delta',
      responseText: 'cached risk snapshot',
    });

    const snapshot = await memoryFabricAnalyticsService.getSnapshot({
      sku: 'finance-memory-fabric',
      sectorId: 'finance',
    });

    expect(snapshot.summary.totalOperations).toBeGreaterThanOrEqual(2);
    expect(snapshot.bySku[0].ttlClampCount).toBeGreaterThanOrEqual(1);
    expect(snapshot.bySku[0].hits).toBeGreaterThanOrEqual(1);
    expect(snapshot.bySku[0].estimatedUsdSaved).toBeGreaterThan(0);
    expect(snapshot.bySector[0].sectorId).toBe('finance');
  });
});
