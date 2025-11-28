import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

export const config = {
  runtime: 'nodejs'
};

/**
 * GET /api/pipelines - List user's pipelines
 * POST /api/pipelines - Create new pipeline
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

    // GET - List pipelines
    if (req.method === 'GET') {
      const pipelines = await sql`
        SELECT 
          id,
          name,
          description,
          sector,
          config,
          status,
          created_at,
          updated_at
        FROM pipelines
        WHERE user_id = ${userId}
        ORDER BY updated_at DESC
      `;

      return res.status(200).json({
        pipelines: pipelines.map(p => ({
          ...p,
          config: typeof p.config === 'string' ? JSON.parse(p.config) : p.config
        }))
      });
    }

    // POST - Create pipeline
    if (req.method === 'POST') {
      const { name, description, sector, config } = req.body;

      if (!name || !config) {
        return res.status(400).json({ 
          error: 'name and config are required' 
        });
      }

      const result = await sql`
        INSERT INTO pipelines (
          user_id,
          name,
          description,
          sector,
          config,
          status,
          created_at,
          updated_at
        ) VALUES (
          ${userId},
          ${name},
          ${description || ''},
          ${sector || 'general'},
          ${JSON.stringify(config)},
          'draft',
          NOW(),
          NOW()
        )
        RETURNING id, name, description, sector, config, status, created_at, updated_at
      `;

      return res.status(201).json({
        pipeline: {
          ...result[0],
          config: typeof result[0].config === 'string' 
            ? JSON.parse(result[0].config) 
            : result[0].config
        }
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Pipelines API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
