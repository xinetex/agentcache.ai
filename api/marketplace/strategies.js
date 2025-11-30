import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

export const config = {
  runtime: 'nodejs'
};

/**
 * GET /api/marketplace/strategies
 * Browse lab-validated strategies available for adoption
 * 
 * Query params:
 * - sector: filter by sector
 * - minScore: minimum validation score (0-100)
 * - sort: 'popular' | 'newest' | 'performance' | 'cost'
 * - limit: results per page
 * - offset: pagination offset
 */
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const sql = neon(process.env.DATABASE_URL);

    // GET: Browse marketplace
    if (req.method === 'GET') {
      const {
        sector,
        minScore = 70,
        sort = 'popular',
        limit = 20,
        offset = 0,
        search,
      } = req.query;

      // Build query filters
      const filters = [];
      const params = [];

      // Only show validated/production strategies
      filters.push(`s.status IN ('validated', 'production')`);
      
      // Minimum validation score
      filters.push(`s.validation_score >= ${minScore}`);

      // Sector filter
      if (sector) {
        filters.push(`s.sector = '${sector}'`);
      }

      // Search filter
      if (search) {
        filters.push(`(s.name ILIKE '%${search}%' OR s.use_case ILIKE '%${search}%')`);
      }

      // Sort options
      const sortMap = {
        popular: 's.adoption_count DESC, s.validation_score DESC',
        newest: 's.created_at DESC',
        performance: 's.baseline_hit_rate DESC, s.baseline_latency_p95 ASC',
        cost: 's.baseline_cost_per_1k ASC',
      };
      const orderBy = sortMap[sort] || sortMap.popular;

      const strategies = await sql`
        SELECT 
          s.id,
          s.name,
          s.slug,
          s.sector,
          s.use_case,
          s.hypothesis,
          s.validation_score,
          s.baseline_hit_rate,
          s.baseline_latency_p50,
          s.baseline_latency_p95,
          s.baseline_cost_per_1k,
          s.validation_runs,
          s.adoption_count,
          s.success_rate,
          s.fork_count,
          s.tags,
          s.compliance_flags,
          s.created_at,
          s.last_validated_at,
          COUNT(DISTINCT r.id) as total_ratings,
          AVG(r.rating) as avg_rating,
          u.email as creator_email
        FROM lab_strategies s
        LEFT JOIN strategy_ratings r ON s.id = r.strategy_id
        LEFT JOIN users u ON s.created_by = u.id
        WHERE ${sql.unsafe(filters.join(' AND '))}
        GROUP BY s.id, u.email
        ORDER BY ${sql.unsafe(orderBy)}
        LIMIT ${parseInt(limit)}
        OFFSET ${parseInt(offset)}
      `;

      // Get total count for pagination
      const [{ count }] = await sql`
        SELECT COUNT(*) as count
        FROM lab_strategies s
        WHERE ${sql.unsafe(filters.join(' AND '))}
      `;

      return res.status(200).json({
        strategies: strategies.map(s => ({
          ...s,
          // Hide creator email in public marketplace
          creator: s.creator_email ? s.creator_email.split('@')[0] : 'anonymous',
          creator_email: undefined,
        })),
        pagination: {
          total: parseInt(count),
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + parseInt(limit) < parseInt(count),
        },
      });
    }

    // POST: Adopt a strategy
    if (req.method === 'POST') {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.id;

      const { strategyId, customizations } = req.body;

      if (!strategyId) {
        return res.status(400).json({ error: 'strategyId is required' });
      }

      // Get strategy
      const [strategy] = await sql`
        SELECT * FROM lab_strategies WHERE id = ${strategyId}
      `;

      if (!strategy) {
        return res.status(404).json({ error: 'Strategy not found' });
      }

      // Create adoption record
      const [adoption] = await sql`
        INSERT INTO strategy_adoptions (
          strategy_id,
          user_id,
          customizations,
          adopted_at
        ) VALUES (
          ${strategyId},
          ${userId},
          ${JSON.stringify(customizations || {})},
          NOW()
        )
        RETURNING id, adopted_at
      `;

      // Increment adoption count
      await sql`
        UPDATE lab_strategies
        SET adoption_count = adoption_count + 1
        WHERE id = ${strategyId}
      `;

      // Create user's own copy (fork)
      const config = typeof strategy.config === 'string'
        ? JSON.parse(strategy.config)
        : strategy.config;

      // Apply customizations if provided
      let finalConfig = config;
      if (customizations) {
        finalConfig = { ...config, ...customizations };
      }

      const [userStrategy] = await sql`
        INSERT INTO lab_strategies (
          name,
          slug,
          sector,
          use_case,
          hypothesis,
          config,
          status,
          created_by,
          parent_strategy_id,
          tags,
          compliance_flags
        ) VALUES (
          ${`${strategy.name} (My Copy)`},
          ${`${strategy.slug}-fork-${Date.now()}`},
          ${strategy.sector},
          ${strategy.use_case},
          ${`Forked from ${strategy.name}`},
          ${JSON.stringify(finalConfig)},
          'draft',
          ${userId},
          ${strategyId},
          ${strategy.tags},
          ${strategy.compliance_flags}
        )
        RETURNING id
      `;

      // Update fork count
      await sql`
        UPDATE lab_strategies
        SET fork_count = fork_count + 1
        WHERE id = ${strategyId}
      `;

      return res.status(201).json({
        adoptionId: adoption.id,
        userStrategyId: userStrategy.id,
        message: 'Strategy adopted successfully',
        adoptedAt: adoption.adopted_at,
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Marketplace error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
