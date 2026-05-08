import { describe, expect, it } from 'vitest';
import { OperatorKnowledgeGraphService } from '../../src/services/OperatorKnowledgeGraphService.js';

describe('OperatorKnowledgeGraphService', () => {
  it('builds a graph that connects offers to evidence signals', async () => {
    const service = new OperatorKnowledgeGraphService({
      getReceiptSummary: async () => ({
        total: 12,
        byProducerSystem: [
          { system: 'agentcache-ai', count: 7 },
          { system: 'jettythunder', count: 5 },
        ],
        bySubjectKind: [
          { kind: 'EXECUTION_RUN', count: 4 },
          { kind: 'STORAGE_TRANSFER', count: 3 },
        ],
        byVerdict: [],
        bySector: [],
        providers: [],
        browser: {
          proofs: 2,
          byExecutionMode: [],
          byEngine: [],
          byHomeostasisStatus: [],
          averageConfidence: 0.9,
          failureRate: 0,
        },
        commerce: {
          lifecycleEvents: 0,
          byAction: [],
          byEscrowStatus: [],
          byBuyerId: [],
          bySellerAgentProfileId: [],
        },
        storage: {
          transfers: 3,
          byDirection: [],
          byNamespace: [],
          byTenantId: [],
        },
      }),
      getDriftSummary: async () => ({
        totalEvaluations: 5,
        stableEvaluations: 3,
        watchEvaluations: 1,
        driftingEvaluations: 1,
        averageSurpriseScore: 0.22,
        recentEvaluations: [],
      }),
    });

    const graph = await service.buildGraph();

    expect(graph.nodes.some((node) => node.id === 'system:agentcache')).toBe(true);
    expect(graph.nodes.some((node) => node.id === 'offer:execution-drift-guard')).toBe(true);
    expect(graph.nodes.some((node) => node.id === 'signal:execution-drift')).toBe(true);
    expect(graph.nodes.some((node) => node.id === 'signal:receipts')).toBe(true);
    expect(
      graph.links.some(
        (link) =>
          link.source === 'offer:execution-drift-guard' &&
          link.target === 'signal:execution-drift'
      )
    ).toBe(true);
    expect(graph.stats.receiptTotal).toBe(12);
    expect(graph.stats.driftingEvaluations).toBe(1);
  });
});
