import { neon } from '@neondatabase/serverless';

export const config = {
  runtime: 'nodejs'
};

/**
 * POST /api/wizard/learn
 * Store successful pipeline patterns for future recommendations
 * 
 * Body: {
 *   pipelineId: 'uuid',
 *   sector: 'healthcare',
 *   useCase: 'Caching patient records',
 *   nodes: [...],
 *   metrics: { hitRate: 0.89, latency: 78, ... }
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
    const { pipelineId, sector, useCase, nodes, metrics } = req.body;

    if (!pipelineId || !sector || !useCase || !nodes) {
      return res.status(400).json({ 
        error: 'pipelineId, sector, useCase, and nodes are required' 
      });
    }

    const sql = neon(process.env.DATABASE_URL);

    // Store learned pattern
    await sql`
      INSERT INTO wizard_learnings (
        pipeline_id,
        sector,
        use_case,
        node_config,
        performance_metrics,
        success_score,
        learned_at
      ) VALUES (
        ${pipelineId},
        ${sector},
        ${useCase},
        ${JSON.stringify(nodes)},
        ${JSON.stringify(metrics || {})},
        ${calculateSuccessScore(metrics)},
        NOW()
      )
      ON CONFLICT (pipeline_id) 
      DO UPDATE SET
        performance_metrics = EXCLUDED.performance_metrics,
        success_score = EXCLUDED.success_score,
        learned_at = NOW()
    `;

    return res.status(200).json({
      success: true,
      message: 'Pattern learned successfully',
      score: calculateSuccessScore(metrics)
    });

  } catch (error) {
    console.error('Wizard learn error:', error);
    return res.status(500).json({
      error: 'Failed to store learning',
      message: error.message
    });
  }
}

/**
 * Calculate success score (0-100) based on metrics
 */
function calculateSuccessScore(metrics) {
  if (!metrics) return 50;

  let score = 0;
  
  // Hit rate (40 points max)
  if (metrics.hitRate) {
    score += metrics.hitRate * 40;
  }
  
  // Latency (30 points max - lower is better)
  if (metrics.avgLatency) {
    const latencyScore = Math.max(0, 1 - (metrics.avgLatency / 500));
    score += latencyScore * 30;
  }
  
  // Throughput (30 points max)
  if (metrics.throughput) {
    const throughputScore = Math.min(1, metrics.throughput / 1000);
    score += throughputScore * 30;
  }

  return Math.round(score);
}
