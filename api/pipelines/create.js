import { query } from '../../lib/db.js';
import { verifyToken } from '../../lib/jwt.js';

/**
 * POST /api/pipelines/create
 * Creates a new pipeline
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Auth
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

    // Validate required fields
    const { name, sector, nodes, connections, description, complexity, monthlyCost, features } = req.body;
    
    if (!name || !sector) {
      return res.status(400).json({ error: 'Missing required fields: name, sector' });
    }

    // Calculate node count and complexity
    const nodeCount = nodes?.length || 0;
    const complexityTier = complexity?.tier || (nodeCount < 3 ? 'simple' : nodeCount < 6 ? 'moderate' : 'complex');
    const complexityScore = complexity?.score || (nodeCount * 15);

    // Insert pipeline
    const result = await query(`
      INSERT INTO pipelines (
        user_id, name, description, sector, nodes, connections, features,
        complexity_tier, complexity_score, monthly_cost, node_count, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id, name, sector, status, created_at
    `, [
      userId,
      name,
      description || '',
      sector,
      JSON.stringify(nodes || []),
      JSON.stringify(connections || []),
      JSON.stringify(features || []),
      complexityTier,
      complexityScore,
      monthlyCost || 0,
      nodeCount,
      'draft'
    ]);

    const pipeline = result.rows[0];

    return res.status(201).json({
      success: true,
      pipeline: {
        id: pipeline.id,
        name: pipeline.name,
        sector: pipeline.sector,
        status: pipeline.status,
        createdAt: pipeline.created_at
      }
    });

  } catch (error) {
    console.error('Pipeline create error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
