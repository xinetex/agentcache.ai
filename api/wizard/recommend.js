import { PipelineWizard } from '../../lib/wizard-framework.js';
import { neon } from '@neondatabase/serverless';

export const config = {
  runtime: 'nodejs'
};

/**
 * POST /api/wizard/recommend
 * AI-powered pipeline recommendation
 * Powered by lab-validated strategies with statistical confidence
 * 
 * Body: {
 *   sector: 'healthcare' | 'finance' | 'filestorage' | ...,
 *   useCase: 'Caching patient records',
 *   traffic: 'steady' | 'bursty' | 'spiky',
 *   qps: 100,
 *   priority: 'performance' | 'balanced' | 'cost',
 *   compliance: ['HIPAA', 'PCI-DSS'] (optional)
 * }
 */
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sector, useCase, traffic, qps, priority, compliance } = req.body;

    // Validate input
    if (!sector || !useCase) {
      return res.status(400).json({ 
        error: 'sector and useCase are required' 
      });
    }

    const sql = neon(process.env.DATABASE_URL);

    // Query lab database for validated strategies
    const complianceFilter = compliance && compliance.length > 0
      ? sql`AND s.compliance_flags && ARRAY[${sql.array(compliance, 'text')}]`
      : sql``;

    const strategies = await sql`
      SELECT 
        s.id,
        s.name,
        s.slug,
        s.sector,
        s.use_case,
        s.config,
        s.validation_score,
        s.baseline_hit_rate,
        s.baseline_latency_p95,
        s.baseline_cost_per_1k,
        s.validation_runs,
        s.adoption_count,
        s.success_rate,
        s.tags,
        COUNT(e.id) as total_experiments
      FROM lab_strategies s
      LEFT JOIN lab_experiments e ON s.id = e.strategy_id AND e.status = 'completed'
      WHERE s.status IN ('validated', 'production')
        AND s.sector = ${sector}
        ${complianceFilter}
      GROUP BY s.id
      HAVING COUNT(e.id) >= 5
      ORDER BY 
        s.validation_score DESC NULLS LAST,
        s.adoption_count DESC
      LIMIT 5
    `;

    // If lab strategies exist, use them. Otherwise fall back to wizard framework
    if (strategies.length > 0) {
      const topStrategy = strategies[0];
      const config = typeof topStrategy.config === 'string' 
        ? JSON.parse(topStrategy.config) 
        : topStrategy.config;
      
      const wizardConfig = convertLabStrategyToWizard(topStrategy, config);
      const alternatives = strategies.slice(1, 4).map(s => {
        const sConfig = typeof s.config === 'string' ? JSON.parse(s.config) : s.config;
        return convertLabStrategyToWizard(s, sConfig);
      });

      return res.status(200).json({
        recommended: wizardConfig.nodes,
        confidence: Math.round(topStrategy.validation_score || 85),
        reason: wizardConfig.reasoning,
        basedOn: `Based on ${topStrategy.total_experiments} validation runs and ${topStrategy.adoption_count} production deployments`,
        expectedMetrics: {
          hitRate: parseFloat(topStrategy.baseline_hit_rate || 0.80),
          avgLatency: parseInt(topStrategy.baseline_latency_p95 || 150),
          costSavings: parseFloat(topStrategy.baseline_cost_per_1k || 0.10),
        },
        wizardGenerated: false,
        labValidated: true,
        labStrategyId: topStrategy.id,
        alternatives: alternatives.map(a => ({
          name: a.name,
          nodes: a.nodes,
          expectedMetrics: a.expectedMetrics,
        })),
      });
    }

    // Fallback: Use wizard framework if no lab strategies
    const wizard = new PipelineWizard();
    const analysis = await wizard.analyzeUseCase(useCase, { 
      sector,
      traffic,
      qps 
    });

    const nodes = analysis.learned 
      ? analysis.suggestions 
      : generateDefaultNodes(sector, traffic, priority);

    const expectedMetrics = estimateMetrics(nodes, traffic, qps);

    return res.status(200).json({
      recommended: nodes,
      confidence: analysis.confidence || 60,
      reason: analysis.reason || 'Generated from default templates',
      expectedMetrics,
      wizardGenerated: true,
      labValidated: false,
      alternatives: generateAlternatives(sector, traffic)
    });

  } catch (error) {
    console.error('Wizard recommend error:', error);
    return res.status(500).json({
      error: 'Failed to generate recommendation',
      message: error.message
    });
  }
}

/**
 * Generate default node configuration
 */
function generateDefaultNodes(sector, traffic, priority = 'balanced') {
  const nodes = [
    {
      id: 'cache_l1',
      type: 'cache_l1',
      label: 'L1 Cache',
      config: {
        size_mb: traffic === 'bursty' ? 512 : 256,
        ttl_seconds: 300
      },
      position: { x: 100, y: 200 }
    }
  ];

  // Add L2 for anything except low-priority cost scenarios
  if (priority !== 'cost') {
    nodes.push({
      id: 'cache_l2',
      type: 'cache_l2',
      label: 'L2 Cache',
      config: {
        size_mb: 2048,
        ttl_seconds: 3600
      },
      position: { x: 300, y: 200 }
    });
  }

  // Add sector-specific nodes
  if (sector === 'healthcare') {
    nodes.push({
      id: 'pii_redaction',
      type: 'pii_redaction',
      label: 'PII Redaction',
      config: { mode: 'strict' },
      position: { x: 100, y: 100 }
    });
  } else if (sector === 'finance') {
    nodes.push({
      id: 'audit_log',
      type: 'audit_log',
      label: 'Audit Log',
      config: { retention_days: 90 },
      position: { x: 300, y: 100 }
    });
  } else if (sector === 'filestorage') {
    nodes.push({
      id: 'cdn_integration',
      type: 'cdn',
      label: 'CDN Layer',
      config: { edge_locations: 'all' },
      position: { x: 500, y: 200 }
    });
  }

  // Add L3 vector for high-performance scenarios
  if (priority === 'performance') {
    nodes.push({
      id: 'cache_l3',
      type: 'cache_l3_vector',
      label: 'Vector Cache',
      config: {
        dimensions: 1536,
        similarity_threshold: 0.85
      },
      position: { x: 500, y: 300 }
    });
  }

  return nodes;
}

/**
 * Estimate performance metrics
 */
function estimateMetrics(nodes, traffic, qps) {
  const hasL1 = nodes.some(n => n.type === 'cache_l1');
  const hasL2 = nodes.some(n => n.type === 'cache_l2');
  const hasL3 = nodes.some(n => n.type.includes('l3'));

  let baseHitRate = 0.65;
  if (hasL2) baseHitRate += 0.15;
  if (hasL3) baseHitRate += 0.10;

  let baseLatency = 120;
  if (hasL1) baseLatency -= 40;
  if (hasL3) baseLatency += 20; // Vector search is slower

  // Adjust for traffic pattern
  if (traffic === 'steady') {
    baseHitRate += 0.05;
  } else if (traffic === 'spiky') {
    baseHitRate -= 0.05;
    baseLatency += 10;
  }

  return {
    hitRate: Math.min(0.95, baseHitRate),
    avgLatency: baseLatency,
    throughput: qps * baseHitRate,
    estimatedCostSavings: calculateCostSavings(qps, baseHitRate)
  };
}

/**
 * Calculate estimated cost savings
 */
function calculateCostSavings(qps, hitRate) {
  const requestsPerMonth = qps * 60 * 60 * 24 * 30;
  const cachedRequests = requestsPerMonth * hitRate;
  const costPerLLMCall = 0.002; // Average $0.002 per LLM call
  const monthlySavings = cachedRequests * costPerLLMCall;
  
  return {
    monthly: Math.round(monthlySavings * 100) / 100,
    yearly: Math.round(monthlySavings * 12 * 100) / 100
  };
}

/**
 * Generate alternative configurations
 */
function generateAlternatives(sector, traffic) {
  return [
    {
      name: 'Performance-Optimized',
      description: 'Maximum speed, higher cost',
      nodes: 4,
      estimatedCost: 89
    },
    {
      name: 'Balanced',
      description: 'Good speed and cost balance',
      nodes: 3,
      estimatedCost: 49
    },
    {
      name: 'Cost-Optimized',
      description: 'Minimum cost, acceptable speed',
      nodes: 2,
      estimatedCost: 29
    }
  ];
}

/**
 * Convert lab strategy configuration to wizard node format
 */
function convertLabStrategyToWizard(strategy, config) {
  const nodes = [];
  let nodeId = 0;
  
  // Generate nodes from tier configuration
  if (config.tiers?.L1?.enabled) {
    nodes.push({
      id: `l1-${nodeId++}`,
      type: 'cache_l1',
      label: 'L1 Cache',
      config: {
        ttl_seconds: config.tiers.L1.ttl,
        size: config.tiers.L1.maxSize,
        policy: config.tiers.L1.policy,
        compression: config.tiers.L1.compression || false,
        encryption: config.tiers.L1.encryption || false,
      },
      position: { x: 100, y: 200 },
    });
  }
  
  if (config.tiers?.L2?.enabled) {
    nodes.push({
      id: `l2-${nodeId++}`,
      type: 'cache_l2',
      label: 'L2 Cache',
      config: {
        ttl_seconds: config.tiers.L2.ttl,
        size: config.tiers.L2.maxSize,
        policy: config.tiers.L2.policy,
        compression: config.tiers.L2.compression || false,
      },
      position: { x: 300, y: 200 },
    });
  }
  
  if (config.tiers?.L3?.enabled) {
    nodes.push({
      id: `l3-${nodeId++}`,
      type: 'cache_l3_vector',
      label: 'Vector Cache',
      config: {
        ttl_seconds: config.tiers.L3.ttl,
        semantic: config.tiers.L3.semantic || false,
        similarity_threshold: config.tiers.L3.similarityThreshold || 0.85,
      },
      position: { x: 500, y: 200 },
    });
  }
  
  // Add compliance/validation nodes
  if (config.validation?.hipaa || config.validation?.piiFilter) {
    nodes.push({
      id: `pii-${nodeId++}`,
      type: 'pii_redaction',
      label: 'PII/PHI Protection',
      config: {
        mode: 'strict',
        hipaa: config.validation.hipaa || false,
      },
      position: { x: 100, y: 100 },
    });
  }
  
  // Generate reasoning
  const hitRate = parseFloat(strategy.baseline_hit_rate || 0);
  const latency = parseInt(strategy.baseline_latency_p95 || 0);
  const validationRuns = parseInt(strategy.validation_runs || 0);
  
  const reasoningParts = [];
  if (hitRate >= 0.9) {
    reasoningParts.push(`Achieves exceptional ${Math.round(hitRate * 100)}% hit rate`);
  } else if (hitRate >= 0.8) {
    reasoningParts.push(`Delivers strong ${Math.round(hitRate * 100)}% hit rate`);
  }
  
  if (latency < 50) {
    reasoningParts.push(`with ultra-low latency (${latency}ms p95)`);
  } else if (latency < 200) {
    reasoningParts.push(`with low latency (${latency}ms p95)`);
  }
  
  reasoningParts.push(`Validated across ${validationRuns} independent test runs`);
  
  return {
    name: strategy.name,
    nodes,
    reasoning: reasoningParts.join('. ') + '.',
    expectedMetrics: {
      hitRate: Math.round(hitRate * 100) / 100,
      avgLatency: latency,
      costSavings: parseFloat(strategy.baseline_cost_per_1k || 0.10),
    },
  };
}
