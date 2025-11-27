import { query } from '../../lib/db.js';
import { verifyToken } from '../../lib/jwt.js';

/**
 * GET /api/pipelines/list
 * Returns user's pipelines with 24h performance metrics
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get user from JWT token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const userId = decoded.userId;

    // Query parameters
    const { status, sector, limit = 50, offset = 0 } = req.query;

    // Build WHERE clause
    let whereConditions = ['p.user_id = $1', "p.status != 'archived'"];
    const params = [userId];
    
    if (status) {
      params.push(status);
      whereConditions.push(`p.status = $${params.length}`);
    }
    
    if (sector) {
      params.push(sector);
      whereConditions.push(`p.sector = $${params.length}`);
    }

    // Get pipelines with metrics
    const pipelinesResult = await query(`
      SELECT 
        p.id, p.name, p.description, p.sector, p.status,
        p.complexity_tier, p.complexity_score, p.monthly_cost,
        p.node_count, p.nodes, p.connections, p.features,
        p.created_at, p.updated_at, p.deployed_at,
        COALESCE(SUM(pm.requests), 0) as requests_24h,
        COALESCE(SUM(pm.cache_hits), 0) as hits_24h,
        COALESCE(SUM(pm.cache_misses), 0) as misses_24h,
        COALESCE(AVG(pm.hit_rate), 0) as hit_rate_24h,
        COALESCE(ROUND(AVG(pm.latency_p50)), 0) as latency_p50_24h,
        COALESCE(ROUND(AVG(pm.latency_p95)), 0) as latency_p95_24h,
        COALESCE(SUM(pm.cost_saved), 0) as cost_saved_24h,
        COALESCE(SUM(pm.tokens_saved), 0) as tokens_saved_24h
      FROM pipelines p
      LEFT JOIN pipeline_metrics pm ON pm.pipeline_id = p.id 
        AND pm.timestamp >= NOW() - INTERVAL '24 hours'
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY p.id, p.name, p.description, p.sector, p.status,
               p.complexity_tier, p.complexity_score, p.monthly_cost,
               p.node_count, p.nodes, p.connections, p.features,
               p.created_at, p.updated_at, p.deployed_at
      ORDER BY p.updated_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);

    // Get total count
    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM pipelines p
      WHERE ${whereConditions.join(' AND ')}
    `, params);

    const total = parseInt(countResult.rows[0]?.total || 0);

    // Format response
    const pipelines = pipelinesResult.rows.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      sector: p.sector,
      status: p.status,
      complexity: {
        tier: p.complexity_tier,
        score: p.complexity_score
      },
      monthlyCost: parseFloat(p.monthly_cost || 0),
      nodeCount: p.node_count || p.nodes?.length || 0,
      nodes: p.nodes || [],
      connections: p.connections || [],
      features: p.features || [],
      metrics24h: {
        requests: parseInt(p.requests_24h || 0),
        hits: parseInt(p.hits_24h || 0),
        misses: parseInt(p.misses_24h || 0),
        hitRate: parseFloat(p.hit_rate_24h || 0),
        latencyP50: parseInt(p.latency_p50_24h || 0),
        latencyP95: parseInt(p.latency_p95_24h || 0),
        costSaved: parseFloat(p.cost_saved_24h || 0),
        tokensSaved: parseInt(p.tokens_saved_24h || 0)
      },
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      deployedAt: p.deployed_at
    }));

    return res.status(200).json({
      pipelines,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + pipelines.length < total
      }
    });

  } catch (error) {
    console.error('Pipelines list error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
