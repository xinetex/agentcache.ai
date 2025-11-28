import { PipelineWizard } from '../../lib/wizard-framework.js';

export const config = {
  runtime: 'nodejs'
};

/**
 * POST /api/wizard/recommend
 * AI-powered pipeline recommendation
 * 
 * Body: {
 *   sector: 'healthcare' | 'finance' | 'filestorage' | ...,
 *   useCase: 'Caching patient records',
 *   traffic: 'steady' | 'bursty' | 'spiky',
 *   qps: 100,
 *   priority: 'performance' | 'balanced' | 'cost'
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
    const { sector, useCase, traffic, qps, priority } = req.body;

    // Validate input
    if (!sector || !useCase) {
      return res.status(400).json({ 
        error: 'sector and useCase are required' 
      });
    }

    // Initialize wizard
    const wizard = new PipelineWizard();

    // Check if wizard has learned this pattern before
    const analysis = await wizard.analyzeUseCase(useCase, { 
      sector,
      traffic,
      qps 
    });

    // Generate config based on learned patterns or inference
    const nodes = analysis.learned 
      ? analysis.suggestions 
      : generateDefaultNodes(sector, traffic, priority);

    // Calculate expected metrics
    const expectedMetrics = estimateMetrics(nodes, traffic, qps);

    return res.status(200).json({
      recommended: {
        nodes,
        sector,
        config: {
          traffic,
          qps,
          priority: priority || 'balanced'
        }
      },
      confidence: analysis.confidence,
      reason: analysis.reason,
      expectedMetrics,
      wizardGenerated: true,
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
