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

    // Get current month usage
    const usageResult = await query(`
      SELECT * FROM get_current_month_usage($1)
    `, [userId]);

    const usage = usageResult.rows[0] || {
      requests: 0,
      hits: 0,
      hit_rate: 0,
      cost_saved: 0
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

    // Get recent pipelines
    const recentPipelinesResult = await query(`
      SELECT 
        id, name, sector, status, complexity_tier,
        monthly_cost, nodes, connections,
        created_at, updated_at
      FROM pipelines
      WHERE user_id = $1 AND status != 'archived'
      ORDER BY updated_at DESC
      LIMIT 5
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
        requests: parseInt(usage.requests),
        hits: parseInt(usage.hits),
        hitRate: parseFloat(usage.hit_rate),
        costSaved: parseFloat(usage.cost_saved)
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
          monthlyCost: parseFloat(p.monthly_cost),
          nodeCount: p.nodes?.length || 0,
          connectionCount: p.connections?.length || 0,
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
