import { query } from '../../lib/db.js';
import { verifyToken } from '../../lib/jwt.js';

/**
 * PUT /api/pipelines/update
 * Updates an existing pipeline
 */
export default async function handler(req, res) {
  if (req.method !== 'PUT') {
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

    // Get pipeline ID from query or body
    const { id } = req.query;
    const { name, description, sector, nodes, connections, features, status, monthlyCost } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: 'Missing pipeline ID' });
    }

    // Verify ownership
    const ownerCheck = await query(
      'SELECT id FROM pipelines WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Pipeline not found or access denied' });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (sector !== undefined) {
      updates.push(`sector = $${paramCount++}`);
      values.push(sector);
    }
    if (nodes !== undefined) {
      updates.push(`nodes = $${paramCount++}`);
      values.push(JSON.stringify(nodes));
      // Update node_count
      updates.push(`node_count = $${paramCount++}`);
      values.push(nodes.length);
    }
    if (connections !== undefined) {
      updates.push(`connections = $${paramCount++}`);
      values.push(JSON.stringify(connections));
    }
    if (features !== undefined) {
      updates.push(`features = $${paramCount++}`);
      values.push(JSON.stringify(features));
    }
    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
      // Set deployed_at if status changed to active
      if (status === 'active') {
        updates.push(`deployed_at = NOW()`);
      }
    }
    if (monthlyCost !== undefined) {
      updates.push(`monthly_cost = $${paramCount++}`);
      values.push(monthlyCost);
    }

    // Always update updated_at
    updates.push(`updated_at = NOW()`);

    if (updates.length === 1) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Add pipeline ID as last parameter
    values.push(id);

    // Execute update
    const result = await query(`
      UPDATE pipelines
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, name, sector, status, updated_at
    `, values);

    const pipeline = result.rows[0];

    return res.status(200).json({
      success: true,
      pipeline: {
        id: pipeline.id,
        name: pipeline.name,
        sector: pipeline.sector,
        status: pipeline.status,
        updatedAt: pipeline.updated_at
      }
    });

  } catch (error) {
    console.error('Pipeline update error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
