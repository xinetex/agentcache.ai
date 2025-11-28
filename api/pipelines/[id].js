import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

export const config = {
  runtime: 'nodejs'
};

/**
 * GET /api/pipelines/[id] - Get single pipeline
 * PUT /api/pipelines/[id] - Update pipeline
 * DELETE /api/pipelines/[id] - Delete pipeline
 */
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
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

    // Get pipeline ID from URL
    const pipelineId = req.query.id;
    if (!pipelineId) {
      return res.status(400).json({ error: 'Pipeline ID required' });
    }

    const sql = neon(process.env.DATABASE_URL);

    // GET - Single pipeline
    if (req.method === 'GET') {
      const result = await sql`
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
        WHERE id = ${pipelineId} AND user_id = ${userId}
      `;

      if (result.length === 0) {
        return res.status(404).json({ error: 'Pipeline not found' });
      }

      const pipeline = result[0];
      return res.status(200).json({
        pipeline: {
          ...pipeline,
          config: typeof pipeline.config === 'string' 
            ? JSON.parse(pipeline.config) 
            : pipeline.config
        }
      });
    }

    // PUT - Update pipeline
    if (req.method === 'PUT') {
      const { name, description, sector, config, status } = req.body;

      const result = await sql`
        UPDATE pipelines
        SET
          name = COALESCE(${name}, name),
          description = COALESCE(${description}, description),
          sector = COALESCE(${sector}, sector),
          config = COALESCE(${config ? JSON.stringify(config) : null}, config),
          status = COALESCE(${status}, status),
          updated_at = NOW()
        WHERE id = ${pipelineId} AND user_id = ${userId}
        RETURNING id, name, description, sector, config, status, created_at, updated_at
      `;

      if (result.length === 0) {
        return res.status(404).json({ error: 'Pipeline not found' });
      }

      return res.status(200).json({
        pipeline: {
          ...result[0],
          config: typeof result[0].config === 'string' 
            ? JSON.parse(result[0].config) 
            : result[0].config
        }
      });
    }

    // DELETE - Delete pipeline
    if (req.method === 'DELETE') {
      const result = await sql`
        DELETE FROM pipelines
        WHERE id = ${pipelineId} AND user_id = ${userId}
        RETURNING id
      `;

      if (result.length === 0) {
        return res.status(404).json({ error: 'Pipeline not found' });
      }

      return res.status(200).json({
        success: true,
        message: 'Pipeline deleted'
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Pipeline [id] API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
