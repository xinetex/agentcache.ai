import { query } from '../../lib/db.js';
import { verifyToken } from '../../lib/jwt.js';

/**
 * POST /api/pipelines/generate
 * AI-powered pipeline generation based on prompt and performance goals
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Auth (optional for generation preview)
    const authHeader = req.headers.authorization;
    let userId = null;
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);
      if (decoded) {
        userId = decoded.userId;
      }
    }

    const { prompt, sector, performance = 'balanced' } = req.body;
    
    if (!prompt || !sector) {
      return res.status(400).json({ error: 'Missing required fields: prompt, sector' });
    }

    // Rule-based pipeline generation
    const pipeline = generatePipelineFromPrompt(prompt, sector, performance);

    // If authenticated, optionally save to database
    if (userId && req.body.save) {
      const result = await query(`
        INSERT INTO pipelines (
          user_id, name, description, sector, nodes, connections, features,
          complexity_tier, complexity_score, monthly_cost, node_count, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
      `, [
        userId,
        pipeline.name,
        pipeline.description,
        pipeline.sector,
        JSON.stringify(pipeline.nodes),
        JSON.stringify(pipeline.connections),
        JSON.stringify(pipeline.features),
        pipeline.complexity.tier,
        pipeline.complexity.score,
        pipeline.metrics.estimated_monthly_cost,
        pipeline.nodes.length,
        'draft'
      ]);

      pipeline.id = result.rows[0].id;
      pipeline.saved = true;
    }

    return res.status(200).json({
      success: true,
      pipeline
    });

  } catch (error) {
    console.error('Pipeline generation error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * Rule-based pipeline generation
 * Matches prompt keywords to appropriate node types and configurations
 */
function generatePipelineFromPrompt(prompt, sector, performance) {
  const promptLower = prompt.toLowerCase();
  
  // Detect use case patterns
  const isHighLatency = promptLower.includes('fast') || promptLower.includes('low latency') || promptLower.includes('real-time');
  const isCostOptimized = promptLower.includes('cost') || promptLower.includes('saving') || promptLower.includes('cheap');
  const needsCompliance = promptLower.includes('hipaa') || promptLower.includes('gdpr') || promptLower.includes('compliance');
  const needsSecurity = promptLower.includes('security') || promptLower.includes('fraud') || promptLower.includes('threat');
  const needsAudit = promptLower.includes('audit') || promptLower.includes('logging') || promptLower.includes('trail');

  // Base nodes
  const nodes = [
    { id: 'source', type: 'http_api', name: 'API Source', config: {} }
  ];

  const connections = [];
  let lastNodeId = 'source';

  // Performance-based cache strategy
  if (performance === 'fast' || isHighLatency) {
    // Single L1 cache for minimum latency
    nodes.push({ id: 'l1', type: 'cache_l1', name: 'L1 Cache', config: { ttl: 3600 } });
    connections.push({ from: lastNodeId, to: 'l1' });
    lastNodeId = 'l1';
  } else if (performance === 'cost') {
    // Multi-tier for maximum cost savings
    nodes.push({ id: 'l1', type: 'cache_l1', name: 'L1 Cache', config: { ttl: 1800 } });
    connections.push({ from: lastNodeId, to: 'l1' });
    nodes.push({ id: 'l2', type: 'cache_l2', name: 'L2 Cache', config: { ttl: 7200 } });
    connections.push({ from: 'l1', to: 'l2' });
    nodes.push({ id: 'l3', type: 'cache_l3', name: 'L3 Cache', config: { ttl: 86400 } });
    connections.push({ from: 'l2', to: 'l3' });
    lastNodeId = 'l3';
  } else {
    // Balanced: L1 + L2
    nodes.push({ id: 'l1', type: 'cache_l1', name: 'L1 Cache', config: { ttl: 1800 } });
    connections.push({ from: lastNodeId, to: 'l1' });
    nodes.push({ id: 'l2', type: 'cache_l2', name: 'L2 Cache', config: { ttl: 7200 } });
    connections.push({ from: 'l1', to: 'l2' });
    lastNodeId = 'l2';
  }

  // Sector-specific nodes
  const features = [];
  
  if (sector === 'healthcare' || needsCompliance) {
    nodes.push({ id: 'hipaa', type: 'hipaa_compliance', name: 'HIPAA Audit', config: {} });
    connections.push({ from: lastNodeId, to: 'hipaa' });
    lastNodeId = 'hipaa';
    features.push('hipaa_compliance', 'phi_protection');
  }
  
  if (sector === 'finance' || needsSecurity) {
    nodes.push({ id: 'fraud', type: 'fraud_detection', name: 'Fraud Check', config: {} });
    connections.push({ from: lastNodeId, to: 'fraud' });
    lastNodeId = 'fraud';
    features.push('fraud_detection', 'pci_compliance');
  }
  
  if (sector === 'legal') {
    nodes.push({ id: 'privilege', type: 'privilege_check', name: 'Privilege Protection', config: {} });
    connections.push({ from: lastNodeId, to: 'privilege' });
    lastNodeId = 'privilege';
    features.push('privilege_protection', 'attorney_client');
  }

  if (needsAudit) {
    nodes.push({ id: 'audit', type: 'audit_log', name: 'Audit Logger', config: {} });
    connections.push({ from: lastNodeId, to: 'audit' });
    lastNodeId = 'audit';
    features.push('audit_logging');
  }

  // Final LLM node
  nodes.push({ id: 'llm', type: 'llm_openai', name: 'OpenAI GPT-4', config: { model: 'gpt-4o' } });
  connections.push({ from: lastNodeId, to: 'llm' });

  // Calculate metrics
  const nodeCount = nodes.length;
  const complexityScore = nodeCount * 15 + (features.length * 10);
  const complexityTier = complexityScore < 50 ? 'simple' : complexityScore < 80 ? 'moderate' : 'complex';

  // Estimate costs and performance
  const baseCost = 120;
  const cacheCost = nodes.filter(n => n.type.includes('cache')).length * 40;
  const complianceCost = features.filter(f => f.includes('compliance')).length * 80;
  const monthlyCost = baseCost + cacheCost + complianceCost;

  // Latency estimates
  const latencyMap = { fast: 85, balanced: 145, cost: 220 };
  const baseLatency = latencyMap[performance] || 145;
  const complianceLatency = needsCompliance || needsSecurity ? 30 : 0;
  const estimatedLatency = baseLatency + complianceLatency;

  // Hit rate estimates
  const hitRateMap = { fast: 88, balanced: 91, cost: 93 };
  const estimatedHitRate = hitRateMap[performance] || 91;

  // Cost savings calculation (based on hit rate)
  const savingsPerRequest = 0.002 * (estimatedHitRate / 100);

  // Generate name and description
  const name = generatePipelineName(sector, performance, needsCompliance);
  const description = generateDescription(prompt, sector, nodeCount);

  // Reasoning for AI explanation
  const reasoning = [
    `Selected ${performance} performance profile for ${estimatedLatency}ms p95 latency`,
    `Added ${nodes.filter(n => n.type.includes('cache')).length} cache tier(s) for ${estimatedHitRate}% hit rate`,
    features.length > 0 ? `Included ${features.length} compliance/security features` : null,
    `Estimated ${nodeCount} nodes with ${complexityTier} complexity`,
    `Expected $${savingsPerRequest.toFixed(3)}/request cost savings`
  ].filter(Boolean);

  return {
    name,
    description,
    sector,
    nodes,
    connections,
    features,
    complexity: {
      tier: complexityTier,
      score: complexityScore
    },
    metrics: {
      estimated_latency_ms: estimatedLatency,
      estimated_hit_rate: estimatedHitRate / 100,
      estimated_savings_per_request: savingsPerRequest,
      estimated_monthly_cost: monthlyCost
    },
    reasoning
  };
}

function generatePipelineName(sector, performance, compliance) {
  const perfMap = { fast: 'Fast', balanced: 'Optimized', cost: 'Cost-Efficient' };
  const perfLabel = perfMap[performance] || 'Smart';
  const complianceLabel = compliance ? ' Compliant' : '';
  return `${perfLabel} ${sector.charAt(0).toUpperCase() + sector.slice(1)}${complianceLabel} Pipeline`;
}

function generateDescription(prompt, sector, nodeCount) {
  const truncated = prompt.length > 100 ? prompt.substring(0, 100) + '...' : prompt;
  return `AI-generated ${nodeCount}-node pipeline for ${sector}: ${truncated}`;
}
