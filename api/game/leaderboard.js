import { neon } from '@neondatabase/serverless';

export const config = {
  runtime: 'nodejs'
};

/**
 * GET /api/game/leaderboard - Get agent rankings
 * GET /api/game/leaderboard/patterns - Get top discovered patterns
 * 
 * Public leaderboard for agent competition and pattern discovery
 */
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const { type, sector, limit = 50 } = req.query;

    // Get discovered patterns
    if (type === 'patterns') {
      const sectorFilter = sector ? sql`AND sector = ${sector}` : sql``;
      
      const patterns = await sql`
        SELECT 
          pd.*,
          u.email as discoverer_email,
          COUNT(cst.id) as transfer_count
        FROM pattern_discoveries pd
        LEFT JOIN users u ON u.id = pd.discovered_by
        LEFT JOIN cross_sector_transfers cst ON cst.pattern_id = pd.id
        WHERE pd.validation_score >= 30
          ${sectorFilter}
        GROUP BY pd.id, u.email
        ORDER BY 
          pd.validation_score DESC,
          pd.times_validated DESC,
          pd.discovered_at DESC
        LIMIT ${parseInt(limit)}
      `;

      return res.status(200).json({ patterns });
    }

    // Get agent leaderboard
    const sectorFilter = sector ? sql`AND sector = ${sector}` : sql``;

    const leaderboard = await sql`
      SELECT 
        al.*,
        u.email as agent_email,
        u.created_at as agent_joined,
        (
          SELECT COUNT(*) 
          FROM pattern_discoveries pd 
          WHERE pd.discovered_by = al.user_id
        ) as patterns_discovered
      FROM agent_leaderboard al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE al.total_sessions >= 1
        ${sectorFilter}
      ORDER BY 
        al.total_score DESC,
        al.patterns_discovered DESC,
        al.total_sessions DESC
      LIMIT ${parseInt(limit)}
    `;

    // Get top patterns view
    const topPatterns = await sql`
      SELECT * FROM top_patterns
      WHERE total_validations >= 1
      ORDER BY validation_score DESC
      LIMIT 10
    `;

    // Get intelligence flow (cross-sector knowledge transfer)
    const intelligenceFlow = await sql`
      SELECT * FROM intelligence_flow
      WHERE transfer_count >= 1
      ORDER BY transfer_count DESC, avg_similarity DESC
      LIMIT 10
    `;

    return res.status(200).json({
      leaderboard,
      topPatterns,
      intelligenceFlow,
      stats: {
        totalAgents: leaderboard.length,
        totalPatterns: topPatterns.length,
        totalTransfers: intelligenceFlow.reduce((sum, flow) => sum + flow.transfer_count, 0)
      }
    });

  } catch (error) {
    console.error('Leaderboard API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
