/**
 * GET /api/workspace/list
 * List user's workspaces
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
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

    // Get query params
    const url = new URL(req.url, `http://${req.headers.host}`);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const sector = url.searchParams.get('sector');

    // Build query
    let query;
    if (sector) {
      query = sql`
        SELECT 
          id,
          name,
          sector,
          metrics,
          source,
          created_at,
          updated_at
        FROM workspaces
        WHERE user_id = ${user.id} AND sector = ${sector}
        ORDER BY updated_at DESC
        LIMIT ${limit}
      `;
    } else {
      query = sql`
        SELECT 
          id,
          name,
          sector,
          metrics,
          source,
          created_at,
          updated_at
        FROM workspaces
        WHERE user_id = ${user.id}
        ORDER BY updated_at DESC
        LIMIT ${limit}
      `;
    }

    const workspaces = await query;

    return res.status(200).json({
      success: true,
      workspaces: workspaces.map(w => ({
        id: w.id,
        name: w.name,
        sector: w.sector,
        metrics: w.metrics,
        source: w.source,
        createdAt: w.created_at,
        updatedAt: w.updated_at
      })),
      count: workspaces.length
    });

  } catch (error) {
    console.error('Workspace list error:', error);
    return res.status(500).json({
      error: 'Failed to list workspaces',
      message: error.message
    });
  }
}
