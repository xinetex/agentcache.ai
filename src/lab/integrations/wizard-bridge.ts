/**
 * Wizard Bridge
 * Converts lab-validated strategies into deployable wizard configurations
 */

import type { StrategyConfig } from '../schemas/strategy.js';

export interface WizardTemplate {
  id: string;
  name: string;
  description: string;
  sector: string;
  
  // Wizard-specific metadata
  confidence: number; // 0-100, based on validation_score
  adoptionCount: number;
  successRate: number;
  
  // Performance expectations (from lab baseline)
  expectedMetrics: {
    hitRate: number;
    latencyP95: number;
    costPer1k: number;
  };
  
  // The actual configuration
  config: {
    nodes: WizardNode[];
    connections: WizardConnection[];
    settings: Record<string, any>;
  };
  
  // Reasoning for the user
  reasoning: string;
  basedOn: string; // "Based on 847 similar pipelines in healthcare"
  
  // Lab metadata
  labStrategyId: string;
  validatedAt: string;
  validationRuns: number;
}

export interface WizardNode {
  id: string;
  type: 'cache_tier' | 'router' | 'validator' | 'fallback';
  config: Record<string, any>;
  position?: { x: number; y: number };
}

export interface WizardConnection {
  from: string;
  to: string;
  condition?: string;
}

/**
 * Convert lab strategy to wizard template
 * This is what users see in "Create with AI" wizard
 */
export function strategyToWizardTemplate(
  strategy: StrategyConfig,
  labMetadata: {
    id: string;
    validationScore: number;
    adoptionCount: number;
    successRate: number;
    baselineHitRate: number;
    baselineLatencyP95: number;
    baselineCostPer1k: number;
    validationRuns: number;
    validatedAt: Date;
  }
): WizardTemplate {
  // Generate wizard nodes from tier configuration
  const nodes: WizardNode[] = [];
  const connections: WizardConnection[] = [];
  
  let nodeId = 0;
  const tierNodes: Record<string, string> = {};
  
  // Create nodes for each enabled tier
  if (strategy.tiers.L1.enabled) {
    const id = `l1-${nodeId++}`;
    tierNodes.L1 = id;
    nodes.push({
      id,
      type: 'cache_tier',
      config: {
        tier: 'L1',
        ttl: strategy.tiers.L1.ttl,
        maxSize: strategy.tiers.L1.maxSize,
        policy: strategy.tiers.L1.policy,
        compression: strategy.tiers.L1.compression || false,
        encryption: strategy.tiers.L1.encryption || false,
        prefetch: strategy.tiers.L1.prefetchEnabled || false,
      },
      position: { x: 100, y: 100 },
    });
  }
  
  if (strategy.tiers.L2.enabled) {
    const id = `l2-${nodeId++}`;
    tierNodes.L2 = id;
    nodes.push({
      id,
      type: 'cache_tier',
      config: {
        tier: 'L2',
        ttl: strategy.tiers.L2.ttl,
        maxSize: strategy.tiers.L2.maxSize,
        policy: strategy.tiers.L2.policy,
        compression: strategy.tiers.L2.compression || false,
        encryption: strategy.tiers.L2.encryption || false,
      },
      position: { x: 300, y: 100 },
    });
  }
  
  if (strategy.tiers.L3.enabled) {
    const id = `l3-${nodeId++}`;
    tierNodes.L3 = id;
    nodes.push({
      id,
      type: 'cache_tier',
      config: {
        tier: 'L3',
        ttl: strategy.tiers.L3.ttl,
        maxSize: strategy.tiers.L3.maxSize,
        policy: strategy.tiers.L3.policy,
        semantic: strategy.tiers.L3.semantic || false,
        threshold: strategy.tiers.L3.similarityThreshold || 0.85,
      },
      position: { x: 500, y: 100 },
    });
  }
  
  // Add router node if routing rules exist
  if (strategy.routing && strategy.routing.length > 0) {
    const routerId = `router-${nodeId++}`;
    nodes.push({
      id: routerId,
      type: 'router',
      config: {
        rules: strategy.routing.map(r => ({
          condition: r.condition,
          target: r.action,
          params: r.params,
        })),
      },
      position: { x: 300, y: 250 },
    });
    
    // Connect router to tiers
    Object.values(tierNodes).forEach(tierId => {
      connections.push({ from: routerId, to: tierId });
    });
  } else {
    // Default: linear L1 → L2 → L3 flow
    const tiers = Object.entries(tierNodes);
    for (let i = 0; i < tiers.length - 1; i++) {
      connections.push({
        from: tiers[i][1],
        to: tiers[i + 1][1],
        condition: 'on_miss',
      });
    }
  }
  
  // Add validator node if compliance requirements exist
  if (strategy.validation) {
    const validatorId = `validator-${nodeId++}`;
    nodes.push({
      id: validatorId,
      type: 'validator',
      config: {
        hipaa: strategy.validation.hipaa || false,
        pciDss: strategy.validation.pciDss || false,
        soc2: strategy.validation.soc2 || false,
        piiFilter: strategy.validation.piiFilter || false,
        phiFilter: strategy.validation.phiFilter || false,
        maxStaleness: strategy.validation.maxStalenessSeconds,
      },
      position: { x: 100, y: 250 },
    });
    
    // Connect validator before first tier
    if (tierNodes.L1) {
      connections.push({ from: validatorId, to: tierNodes.L1 });
    }
  }
  
  // Add fallback node (LLM)
  const fallbackId = `fallback-${nodeId++}`;
  nodes.push({
    id: fallbackId,
    type: 'fallback',
    config: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      cacheResponse: true,
    },
    position: { x: 700, y: 100 },
  });
  
  // Connect last tier to fallback
  const lastTier = Object.values(tierNodes).pop();
  if (lastTier) {
    connections.push({ from: lastTier, to: fallbackId, condition: 'on_miss' });
  }
  
  // Generate reasoning text
  const reasoning = generateReasoning(strategy, labMetadata);
  const basedOn = `Based on ${labMetadata.validationRuns} validation runs${
    labMetadata.adoptionCount > 0 
      ? ` and ${labMetadata.adoptionCount} successful production deployments` 
      : ''
  } in ${strategy.sector}`;
  
  return {
    id: labMetadata.id,
    name: strategy.name,
    description: strategy.useCase,
    sector: strategy.sector,
    confidence: Math.round(labMetadata.validationScore),
    adoptionCount: labMetadata.adoptionCount,
    successRate: Math.round(labMetadata.successRate),
    expectedMetrics: {
      hitRate: Math.round(labMetadata.baselineHitRate * 100) / 100,
      latencyP95: labMetadata.baselineLatencyP95,
      costPer1k: Math.round(labMetadata.baselineCostPer1k * 1000) / 1000,
    },
    config: {
      nodes,
      connections,
      settings: {
        sector: strategy.sector,
        useCase: strategy.useCase,
        hypothesis: strategy.hypothesis,
        tags: strategy.tags || [],
        complianceFlags: strategy.complianceFlags || [],
      },
    },
    reasoning,
    basedOn,
    labStrategyId: labMetadata.id,
    validatedAt: labMetadata.validatedAt.toISOString(),
    validationRuns: labMetadata.validationRuns,
  };
}

/**
 * Generate human-readable reasoning for why this configuration is optimal
 */
function generateReasoning(
  strategy: StrategyConfig,
  metadata: { baselineHitRate: number; baselineLatencyP95: number; validationRuns: number }
): string {
  const parts: string[] = [];
  
  // Hit rate achievement
  if (metadata.baselineHitRate >= 0.9) {
    parts.push(`Achieves exceptional ${Math.round(metadata.baselineHitRate * 100)}% hit rate`);
  } else if (metadata.baselineHitRate >= 0.8) {
    parts.push(`Delivers strong ${Math.round(metadata.baselineHitRate * 100)}% hit rate`);
  } else {
    parts.push(`Maintains ${Math.round(metadata.baselineHitRate * 100)}% hit rate`);
  }
  
  // Latency performance
  if (metadata.baselineLatencyP95 < 50) {
    parts.push(`with ultra-low latency (${metadata.baselineLatencyP95}ms p95)`);
  } else if (metadata.baselineLatencyP95 < 200) {
    parts.push(`with low latency (${metadata.baselineLatencyP95}ms p95)`);
  } else {
    parts.push(`with acceptable latency (${metadata.baselineLatencyP95}ms p95)`);
  }
  
  // Key features
  const features: string[] = [];
  
  const enabledTiers = [
    strategy.tiers.L1.enabled && 'L1',
    strategy.tiers.L2.enabled && 'L2',
    strategy.tiers.L3.enabled && 'L3',
  ].filter(Boolean);
  
  if (enabledTiers.length === 3) {
    features.push('3-tier hierarchy for optimal performance');
  } else if (enabledTiers.length === 2) {
    features.push(`${enabledTiers.join('/')} caching`);
  }
  
  if (strategy.tiers.L3.semantic) {
    features.push('semantic deduplication');
  }
  
  if (strategy.validation?.hipaa) {
    features.push('HIPAA-compliant');
  }
  
  if (strategy.validation?.pciDss) {
    features.push('PCI-DSS compliant');
  }
  
  if (features.length > 0) {
    parts.push(`using ${features.join(', ')}`);
  }
  
  // Validation confidence
  parts.push(`Validated across ${metadata.validationRuns} independent test runs`);
  
  return parts.join('. ') + '.';
}

/**
 * Query lab database for best strategies matching user requirements
 */
export interface WizardQuery {
  sector: string;
  useCase?: string;
  trafficPattern?: 'steady' | 'bursty' | 'spiky';
  priority?: 'performance' | 'cost' | 'balanced';
  compliance?: string[]; // ['HIPAA', 'PCI-DSS']
  qps?: number;
}

export interface StrategyRecommendation {
  template: WizardTemplate;
  matchScore: number; // 0-100, how well it matches query
  alternatives: WizardTemplate[];
}

/**
 * This would be called by the wizard API endpoint
 * to find the best lab-validated strategy for user requirements
 */
export function buildRecommendationQuery(query: WizardQuery): string {
  // SQL query to find best matching strategies
  return `
    SELECT 
      s.*,
      COUNT(e.id) as validation_runs,
      AVG(e.hit_rate) as baseline_hit_rate,
      AVG(e.latency_p95) as baseline_latency_p95,
      AVG(e.cost_per_1k_queries) as baseline_cost_per_1k
    FROM lab_strategies s
    LEFT JOIN lab_experiments e ON s.id = e.strategy_id AND e.status = 'completed'
    WHERE s.status IN ('validated', 'production')
      AND s.sector = '${query.sector}'
      ${query.compliance ? `AND s.compliance_flags @> ARRAY[${query.compliance.map(c => `'${c}'`).join(',')}]` : ''}
    GROUP BY s.id
    HAVING COUNT(e.id) >= 10
    ORDER BY 
      s.validation_score DESC,
      AVG(e.hit_rate) DESC
    LIMIT 5
  `;
}
