import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

export const config = {
  runtime: 'nodejs'
};

/**
 * POST /api/game/experiment - Record experiment results
 * GET /api/game/experiment - Get all experiments for user
 * 
 * Granular test data for evaluating cache configurations
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
    // Auth
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    const sql = neon(process.env.DATABASE_URL);

    // POST - Record experiment
    if (req.method === 'POST') {
      const {
        sessionId,
        experimentName,
        dataSource,
        queryPattern,
        requestCount,
        hitRate,
        avgLatency,
        p95Latency,
        p99Latency,
        costSavings,
        observations
      } = req.body;

      if (!sessionId) {
        return res.status(400).json({ error: 'sessionId required' });
      }

      // Verify session belongs to user
      const sessionCheck = await sql`
        SELECT id FROM game_sessions 
        WHERE id = ${sessionId} AND user_id = ${userId}
      `;

      if (sessionCheck.length === 0) {
        return res.status(403).json({ error: 'Session not found or unauthorized' });
      }

      const result = await sql`
        INSERT INTO experiment_results (
          session_id,
          experiment_name,
          data_source,
          query_pattern,
          request_count,
          hit_rate,
          avg_latency_ms,
          p95_latency_ms,
          p99_latency_ms,
          cost_savings_percent,
          observations,
          tested_at
        ) VALUES (
          ${sessionId},
          ${experimentName || 'Experiment'},
          ${dataSource || ''},
          ${queryPattern || ''},
          ${requestCount || 0},
          ${hitRate || 0},
          ${avgLatency || 0},
          ${p95Latency || 0},
          ${p99Latency || 0},
          ${costSavings || 0},
          ${JSON.stringify(observations || {})},
          NOW()
        )
        RETURNING id, tested_at
      `;

      return res.status(201).json({
        experimentId: result[0].id,
        testedAt: result[0].tested_at
      });
    }

    // GET - Get user's experiments
    if (req.method === 'GET') {
      const sessionId = req.query.sessionId;

      let query;
      if (sessionId) {
        // Get experiments for specific session
        query = await sql`
          SELECT 
            er.*,
            gs.sector,
            gs.use_case
          FROM experiment_results er
          JOIN game_sessions gs ON gs.id = er.session_id
          WHERE er.session_id = ${sessionId} AND gs.user_id = ${userId}
          ORDER BY er.tested_at DESC
        `;
      } else {
        // Get all experiments for user
        query = await sql`
          SELECT 
            er.*,
            gs.sector,
            gs.use_case,
            gs.session_type
          FROM experiment_results er
          JOIN game_sessions gs ON gs.id = er.session_id
          WHERE gs.user_id = ${userId}
          ORDER BY er.tested_at DESC
          LIMIT 100
        `;
      }

      return res.status(200).json({ experiments: query });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Game experiment API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
