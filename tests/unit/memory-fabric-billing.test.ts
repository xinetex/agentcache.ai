import { describe, expect, it } from 'vitest';
import { memoryFabricBillingService } from '../../src/services/MemoryFabricBillingService.js';
import { memoryFabricPolicyService } from '../../src/services/MemoryFabricPolicyService.js';

describe('MemoryFabricBillingService', () => {
  it('records SKU-aware estimated credits for reads and writes', async () => {
    const policy = memoryFabricPolicyService.resolve({
      sector: 'finance',
      verticalSku: 'finance-memory-fabric',
      requestedTtlSeconds: 7200,
      tierId: 'pro',
    });

    await memoryFabricBillingService.recordUsage({
      apiKey: 'ac_demo_billing_finance',
      policy,
      operation: 'write',
    });

    await memoryFabricBillingService.recordUsage({
      apiKey: 'ac_demo_billing_finance',
      policy,
      operation: 'read',
      hit: true,
    });

    const summary = await memoryFabricBillingService.getSummary({
      apiKey: 'ac_demo_billing_finance',
    });

    expect(summary.totalCreditsEstimated).toBeGreaterThan(0);
    expect(summary.operations).toBeGreaterThanOrEqual(2);
    expect(summary.bySku.some((item) => item.sku === 'finance-memory-fabric')).toBe(true);
    expect(summary.usdEquivalent).toBeGreaterThanOrEqual(0);
  });

  it('scopes bySku accounting to the requesting account', async () => {
    const financePolicy = memoryFabricPolicyService.resolve({
      sector: 'finance',
      verticalSku: 'finance-memory-fabric',
      requestedTtlSeconds: 300,
      tierId: 'pro',
    });
    const copilotPolicy = memoryFabricPolicyService.resolve({
      sector: 'general',
      verticalSku: 'enterprise-copilot',
      requestedTtlSeconds: 3600,
      tierId: 'pro',
    });

    await memoryFabricBillingService.recordUsage({
      apiKey: 'ac_demo_billing_account_a',
      policy: financePolicy,
      operation: 'read',
      hit: true,
    });

    await memoryFabricBillingService.recordUsage({
      apiKey: 'ac_demo_billing_account_b',
      policy: copilotPolicy,
      operation: 'write',
    });

    const financeSummary = await memoryFabricBillingService.getSummary({
      apiKey: 'ac_demo_billing_account_a',
    });

    expect(financeSummary.bySku.some((item) => item.sku === 'finance-memory-fabric')).toBe(true);
    expect(financeSummary.bySku.some((item) => item.sku === 'enterprise-copilot')).toBe(false);
  });
});
