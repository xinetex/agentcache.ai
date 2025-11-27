import { query } from '../lib/db.js';
import { verifyToken } from '../lib/jwt.js';

/**
 * GET /api/dashboard
 * Returns user's dashboard data: pipelines, usage metrics, and summary stats
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

    // Get user info
    const userResult = await query(
      'SELECT id, email, full_name FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Get usage metrics from pipeline_metrics (last 24h)
    const usageResult = await query(`
      SELECT 
        COALESCE(SUM(requests), 0) as total_requests,
        COALESCE(SUM(cache_hits), 0) as total_hits,
        COALESCE(SUM(cache_misses), 0) as total_misses,
        CASE 
          WHEN SUM(requests) > 0 
          THEN ROUND((SUM(cache_hits)::decimal / SUM(requests)) * 100, 1)
          ELSE 0 
        END as hit_rate,
        COALESCE(ROUND(AVG(latency_p50)), 0) as avg_latency,
        COALESCE(SUM(cost_saved), 0) as cost_saved,
        COALESCE(SUM(tokens_saved), 0) as tokens_saved
      FROM pipeline_metrics pm
      JOIN pipelines p ON p.id = pm.pipeline_id
      WHERE p.user_id = $1
        AND pm.timestamp >= NOW() - INTERVAL '24 hours'
    `, [userId]);

    const usage = usageResult.rows[0] || {
      total_requests: 0,
      total_hits: 0,
      total_misses: 0,
      hit_rate: 0,
      avg_latency: 0,
      cost_saved: 0,
      tokens_saved: 0
    };

    // Get pipelines summary
    const pipelinesResult = await query(`
      SELECT 
        COUNT(*) as total_pipelines,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_pipelines,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_pipelines,
        COALESCE(SUM(monthly_cost), 0) as total_monthly_cost
      FROM pipelines
      WHERE user_id = $1 AND status != 'archived'
    `, [userId]);

    const pipelinesSummary = pipelinesResult.rows[0];

    // Get recent pipelines with 24h metrics
    const recentPipelinesResult = await query(`
      SELECT 
        p.id, p.name, p.sector, p.status, p.complexity_tier,
        p.monthly_cost, p.nodes, p.connections, p.node_count,
        p.created_at, p.updated_at,
        COALESCE(SUM(pm.requests), 0) as requests_24h,
        COALESCE(AVG(pm.hit_rate), 0) as hit_rate_24h,
        COALESCE(SUM(pm.cost_saved), 0) as cost_saved_24h
      FROM pipelines p
      LEFT JOIN pipeline_metrics pm ON pm.pipeline_id = p.id 
        AND pm.timestamp >= NOW() - INTERVAL '24 hours'
      WHERE p.user_id = $1 AND p.status != 'archived'
      GROUP BY p.id, p.name, p.sector, p.status, p.complexity_tier,
               p.monthly_cost, p.nodes, p.connections, p.node_count,
               p.created_at, p.updated_at
      ORDER BY p.updated_at DESC
      LIMIT 10
    `, [userId]);

    // Get API keys count
    const apiKeysResult = await query(`
      SELECT COUNT(*) as total_keys
      FROM api_keys
      WHERE user_id = $1 AND is_active = TRUE
    `, [userId]);

    const apiKeyCount = apiKeysResult.rows[0].total_keys;

    // Get subscription info (if exists)
    const subResult = await query(`
      SELECT plan_tier, status, current_period_end
      FROM subscriptions
      WHERE user_id = $1 AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
    `, [userId]);

    const subscription = subResult.rows[0] || null;

    // Return dashboard data
    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name
      },
      usage: {
        requests: parseInt(usage.total_requests || 0),
        hits: parseInt(usage.total_hits || 0),
        misses: parseInt(usage.total_misses || 0),
        hitRate: parseFloat(usage.hit_rate || 0),
        avgLatency: parseInt(usage.avg_latency || 0),
        costSaved: parseFloat(usage.cost_saved || 0),
        tokensSaved: parseInt(usage.tokens_saved || 0),
        throughput: Math.round((parseInt(usage.total_requests || 0)) / 86400) // req/sec
      },
      pipelines: {
        total: parseInt(pipelinesSummary.total_pipelines),
        active: parseInt(pipelinesSummary.active_pipelines),
        draft: parseInt(pipelinesSummary.draft_pipelines),
        totalMonthlyCost: parseFloat(pipelinesSummary.total_monthly_cost),
        recent: recentPipelinesResult.rows.map(p => ({
          id: p.id,
          name: p.name,
          sector: p.sector,
          status: p.status,
          complexity: p.complexity_tier,
          monthlyCost: parseFloat(p.monthly_cost || 0),
          nodeCount: p.node_count || p.nodes?.length || 0,
          connectionCount: p.connections?.length || 0,
          requests24h: parseInt(p.requests_24h || 0),
          hitRate24h: parseFloat(p.hit_rate_24h || 0),
          costSaved24h: parseFloat(p.cost_saved_24h || 0),
          createdAt: p.created_at,
          updatedAt: p.updated_at
        }))
      },
      apiKeys: {
        count: parseInt(apiKeyCount)
      },
      subscription: subscription ? {
        plan: subscription.plan_tier,
        status: subscription.status,
        periodEnd: subscription.current_period_end
      } : null
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
