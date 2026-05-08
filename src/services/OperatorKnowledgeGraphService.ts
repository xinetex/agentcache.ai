import { getRevenueCoreOffers, type RevenueCoreOffer } from '../config/revenueCore.js';
import { executionDriftService } from './ExecutionDriftService.js';
import { sharedReceiptService, type SharedReceiptSummary } from './SharedReceiptService.js';

export type OperatorGraphNode = {
  id: string;
  name: string;
  group: string;
  val?: number;
  color?: string;
  metadata?: Record<string, unknown>;
};

export type OperatorGraphLink = {
  source: string;
  target: string;
  type: string;
  weight?: number;
};

type Dependencies = {
  getReceiptSummary: () => Promise<SharedReceiptSummary>;
  getDriftSummary: () => Promise<Awaited<ReturnType<typeof executionDriftService.getSummary>>>;
};

function tierColor(tier: RevenueCoreOffer['tier']): string {
  if (tier === 'enterprise') return '#ef7d57';
  if (tier === 'pro') return '#4f8cff';
  return '#57c084';
}

function uniquePush<T extends { id: string }>(items: T[], item: T) {
  if (!items.some((candidate) => candidate.id === item.id)) {
    items.push(item);
  }
}

export class OperatorKnowledgeGraphService {
  constructor(private deps: Dependencies = {
    getReceiptSummary: () => sharedReceiptService.getSummary(),
    getDriftSummary: () => executionDriftService.getSummary(),
  }) {}

  async buildGraph() {
    const offers = getRevenueCoreOffers();
    const [receiptSummary, driftSummary] = await Promise.all([
      this.deps.getReceiptSummary(),
      this.deps.getDriftSummary(),
    ]);

    const nodes: OperatorGraphNode[] = [];
    const links: OperatorGraphLink[] = [];

    uniquePush(nodes, {
      id: 'system:agentcache',
      name: 'AgentCache.ai',
      group: 'system',
      val: 28,
      color: '#111827',
      metadata: {
        offers: offers.length,
        totalReceipts: receiptSummary.total,
        driftEvaluations: driftSummary.totalEvaluations,
      },
    });

    for (const offer of offers) {
      const offerId = `offer:${offer.id}`;
      uniquePush(nodes, {
        id: offerId,
        name: offer.name,
        group: 'offer',
        val: 12 + (4 - offer.launchPriority) * 2,
        color: tierColor(offer.tier),
        metadata: {
          tier: offer.tier,
          buyer: offer.buyer,
          problem: offer.problem,
          outcome: offer.outcome,
        },
      });
      links.push({
        source: 'system:agentcache',
        target: offerId,
        type: 'offers',
        weight: 1,
      });

      for (const endpoint of offer.endpoints.slice(0, 4)) {
        const endpointId = `endpoint:${endpoint}`;
        uniquePush(nodes, {
          id: endpointId,
          name: endpoint,
          group: 'endpoint',
          val: 6,
          color: '#8b9bb4',
        });
        links.push({
          source: offerId,
          target: endpointId,
          type: 'serves',
          weight: 0.7,
        });
      }
    }

    uniquePush(nodes, {
      id: 'signal:execution-drift',
      name: 'Execution Drift',
      group: 'signal',
      val: 10,
      color: '#f4b942',
      metadata: driftSummary,
    });
    links.push({
      source: 'offer:execution-drift-guard',
      target: 'signal:execution-drift',
      type: 'observes',
      weight: 1,
    });

    uniquePush(nodes, {
      id: 'signal:receipts',
      name: 'Shared Receipts',
      group: 'signal',
      val: 10,
      color: '#7c5cff',
      metadata: {
        total: receiptSummary.total,
        browserProofs: receiptSummary.browser.proofs,
        storageTransfers: receiptSummary.storage.transfers,
      },
    });
    links.push({
      source: 'system:agentcache',
      target: 'signal:receipts',
      type: 'proves',
      weight: 1,
    });

    links.push({
      source: 'offer:agent-storage-core',
      target: 'signal:receipts',
      type: 'evidenced_by',
      weight: 0.8,
    });
    links.push({
      source: 'offer:agentcache-guardrails',
      target: 'signal:receipts',
      type: 'evidenced_by',
      weight: 0.8,
    });

    for (const item of receiptSummary.byProducerSystem.slice(0, 4)) {
      const nodeId = `producer:${item.system}`;
      uniquePush(nodes, {
        id: nodeId,
        name: item.system,
        group: 'producer',
        val: 4 + item.count,
        color: '#5bc0be',
        metadata: { count: item.count },
      });
      links.push({
        source: 'signal:receipts',
        target: nodeId,
        type: 'produced_by',
        weight: item.count,
      });
    }

    for (const item of receiptSummary.bySubjectKind.slice(0, 4)) {
      const nodeId = `subject:${item.kind}`;
      uniquePush(nodes, {
        id: nodeId,
        name: item.kind,
        group: 'subject',
        val: 4 + item.count,
        color: '#9d4edd',
        metadata: { count: item.count },
      });
      links.push({
        source: 'signal:receipts',
        target: nodeId,
        type: 'describes',
        weight: item.count,
      });
    }

    const driftStatusNodes: Array<{ id: string; name: string; count: number; color: string }> = [
      { id: 'drift:stable', name: 'Stable', count: driftSummary.stableEvaluations, color: '#57c084' },
      { id: 'drift:watch', name: 'Watch', count: driftSummary.watchEvaluations, color: '#f4b942' },
      { id: 'drift:drifting', name: 'Drifting', count: driftSummary.driftingEvaluations, color: '#ef476f' },
    ];

    for (const item of driftStatusNodes) {
      uniquePush(nodes, {
        id: item.id,
        name: item.name,
        group: 'drift-verdict',
        val: 4 + item.count,
        color: item.color,
        metadata: { count: item.count },
      });
      links.push({
        source: 'signal:execution-drift',
        target: item.id,
        type: 'status',
        weight: item.count || 0.25,
      });
    }

    return {
      nodes,
      links,
      stats: {
        offers: offers.length,
        receiptTotal: receiptSummary.total,
        driftEvaluations: driftSummary.totalEvaluations,
        driftingEvaluations: driftSummary.driftingEvaluations,
        browserProofs: receiptSummary.browser.proofs,
        storageTransfers: receiptSummary.storage.transfers,
      },
    };
  }
}

export const operatorKnowledgeGraphService = new OperatorKnowledgeGraphService();
