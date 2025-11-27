/**
 * POST /api/workspace/save
 * Save workspace to database (authenticated users only)
 */

import { neon } from '@neondatabase/serverless';
import { getUserFromRequest } from '../auth.js';

export const config = {
  runtime: 'nodejs'
};

const sql = neon(process.env.DATABASE_URL);

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
    // Require authentication
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    const { workspace } = req.body;

    if (!workspace || !workspace.id || !workspace.name) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Workspace with id and name required'
      });
    }

    // Check if workspace already exists
    const existing = await sql`
      SELECT id FROM workspaces
      WHERE id = ${workspace.id} AND user_id = ${user.id}
    `;

    if (existing.length > 0) {
      // Update existing workspace
      await sql`
        UPDATE workspaces SET
          name = ${workspace.name},
          sector = ${workspace.sector || 'general'},
          pipeline_data = ${JSON.stringify(workspace.pipeline)},
          scan_results = ${JSON.stringify(workspace.scanResults || {})},
          recommendations = ${JSON.stringify(workspace.recommendations || {})},
          integration_code = ${workspace.integrationCode || ''},
          mesh_network = ${JSON.stringify(workspace.meshNetwork || {})},
          metrics = ${JSON.stringify(workspace.metrics || {})},
          updated_at = NOW()
        WHERE id = ${workspace.id} AND user_id = ${user.id}
      `;

      return res.status(200).json({
        success: true,
        workspace_id: workspace.id,
        action: 'updated'
      });
    } else {
      // Insert new workspace
      await sql`
        INSERT INTO workspaces (
          id,
          user_id,
          name,
          sector,
          pipeline_data,
          scan_results,
          recommendations,
          integration_code,
          mesh_network,
          metrics,
          source,
          created_at,
          updated_at
        ) VALUES (
          ${workspace.id},
          ${user.id},
          ${workspace.name},
          ${workspace.sector || 'general'},
          ${JSON.stringify(workspace.pipeline)},
          ${JSON.stringify(workspace.scanResults || {})},
          ${JSON.stringify(workspace.recommendations || {})},
          ${workspace.integrationCode || ''},
          ${JSON.stringify(workspace.meshNetwork || {})},
          ${JSON.stringify(workspace.metrics || {})},
          ${workspace.source || 'studio'},
          NOW(),
          NOW()
        )
      `;

      return res.status(201).json({
        success: true,
        workspace_id: workspace.id,
        action: 'created'
      });
    }

  } catch (error) {
    console.error('Workspace save error:', error);
    return res.status(500).json({
      error: 'Save failed',
      message: error.message
    });
  }
}
