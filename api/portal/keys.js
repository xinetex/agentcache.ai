import { requireAuth } from '../../lib/auth-middleware.js';
import { query } from '../../lib/db.js';
import crypto from 'crypto';

function generateApiKey() {
  return 'ac_' + crypto.randomBytes(32).toString('hex');
}

function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

export default async function handler(req, res) {
  try {
    // Verify authentication
    const user = await requireAuth(req, res);
    if (!user) return;

    const organizationId = user.organizationId;

    // GET - List all API keys for organization
    if (req.method === 'GET') {
      const result = await query(
        `SELECT id, key, created_at, last_used_at 
         FROM api_keys 
         WHERE organization_id = $1 
         ORDER BY created_at DESC`,
        [organizationId]
      );

      return res.status(200).json({ apiKeys: result.rows });
    }

    // POST - Generate new API key
    if (req.method === 'POST') {
      // Check API key limit based on plan
      const orgResult = await query(
        'SELECT plan_tier, max_api_keys FROM organizations WHERE id = $1',
        [organizationId]
      );

      const org = orgResult.rows[0];
      const keyCountResult = await query(
        'SELECT COUNT(*) as count FROM api_keys WHERE organization_id = $1',
        [organizationId]
      );

      const currentCount = parseInt(keyCountResult.rows[0].count);
      if (currentCount >= org.max_api_keys) {
        return res.status(403).json({ 
          error: `API key limit reached for ${org.plan_tier} plan (max: ${org.max_api_keys})` 
        });
      }

      // Generate new API key
      const apiKey = generateApiKey();
      const hashedKey = hashApiKey(apiKey);

      const result = await query(
        `INSERT INTO api_keys (organization_id, key, key_hash) 
         VALUES ($1, $2, $3) 
         RETURNING id, key, created_at`,
        [organizationId, apiKey, hashedKey]
      );

      return res.status(201).json({ 
        apiKey: result.rows[0],
        message: 'API key generated successfully. Please store it securely as it will not be shown again.'
      });
    }

    // DELETE - Revoke API key
    if (req.method === 'DELETE') {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: 'API key ID is required' });
      }

      // Verify key belongs to organization
      const result = await query(
        'DELETE FROM api_keys WHERE id = $1 AND organization_id = $2 RETURNING id',
        [id, organizationId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'API key not found' });
      }

      return res.status(200).json({ message: 'API key revoked successfully' });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('API keys error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
