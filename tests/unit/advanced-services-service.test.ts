import { describe, expect, it } from 'vitest';
import { advancedServicesService } from '../../src/services/AdvancedServicesService.js';

describe('advanced services service', () => {
  it('exposes the enterprise demand stack as buyer-ready services', () => {
    const catalog = advancedServicesService.getCatalog();
    const ids = catalog.map((service) => service.id);

    expect(ids).toContain('workflow-memory-fabric');
    expect(ids).toContain('agent-reliability-mesh');
    expect(ids).toContain('decisionrail');
    expect(catalog.find((service) => service.id === 'decisionrail')?.endpoints)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ path: '/api/execution/context-packs' }),
      ]));
  });

  it('builds a regulated finance blueprint around memory, reliability, and governed decisions', () => {
    const blueprint = advancedServicesService.buildBlueprint({
      objective: 'Deploy a procurement agent that recommends vendor approvals and never pays without review.',
      sector: 'finance',
      autonomy: 'copilot',
      riskTolerance: 'low',
      systems: ['Slack', 'Salesforce', 'procurement API'],
      painPoints: ['lost context', 'slow approvals', 'audit evidence scattered'],
      regulated: true,
    });

    expect(blueprint.regulated).toBe(true);
    expect(blueprint.recommendedBundle.slice(0, 3).map((item) => item.service.id)).toEqual([
      'workflow-memory-fabric',
      'agent-reliability-mesh',
      'decisionrail',
    ]);
    expect(blueprint.policyPack).toEqual(expect.arrayContaining([
      expect.objectContaining({ control: 'Human approval for final actions', mode: 'review' }),
      expect.objectContaining({ control: 'Receipt retention and audit export', mode: 'review' }),
    ]));
    expect(blueprint.starterRequests).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: '/api/runtime/plan' }),
      expect.objectContaining({ path: '/api/execution/context-packs' }),
    ]));
  });

  it('elevates sandbox and reliability work for shadow launch rehearsals', () => {
    const blueprint = advancedServicesService.buildBlueprint({
      objective: 'Run a launch rehearsal for a support agent and find failure modes before rollout.',
      sector: 'general',
      autonomy: 'shadow',
      riskTolerance: 'medium',
      systems: ['Zendesk', 'internal knowledge base'],
      painPoints: ['test failure modes', 'monitor trust', 'simulate rollout'],
    });

    const selectedIds = blueprint.recommendedBundle.map((item) => item.service.id);
    expect(selectedIds).toContain('synthetic-ops-sandbox');
    expect(selectedIds).toContain('agent-reliability-mesh');
    expect(blueprint.policyPack.find((control) => control.control === 'Execution drift evaluation')?.mode).toBe('monitor');
  });
});
