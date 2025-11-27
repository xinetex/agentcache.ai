import { query } from '../../lib/db.js';
import { verifyToken } from '../../lib/jwt.js';

/**
 * DELETE /api/pipelines/delete
 * Soft deletes a pipeline (sets status to 'archived')
 */
export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
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

    // Get pipeline ID from query
    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({ error: 'Missing pipeline ID' });
    }

    // Verify ownership
    const ownerCheck = await query(
      'SELECT id, name, status FROM pipelines WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Pipeline not found or access denied' });
    }

    const pipeline = ownerCheck.rows[0];

    // Soft delete by setting status to archived
    await query(`
      UPDATE pipelines
      SET status = 'archived', updated_at = NOW()
      WHERE id = $1
    `, [id]);

    return res.status(200).json({
      success: true,
      message: `Pipeline "${pipeline.name}" archived successfully`,
      pipeline: {
        id: pipeline.id,
        name: pipeline.name,
        previousStatus: pipeline.status,
        newStatus: 'archived'
      }
    });

  } catch (error) {
    console.error('Pipeline delete error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
