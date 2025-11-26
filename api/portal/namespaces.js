import { requireAuth, requireOrgAccess } from '../../lib/auth-middleware.js';
import { query } from '../../lib/db.js';
import crypto from 'crypto';

export default async function handler(req, res) {
  try {
    // Verify authentication
    const user = await requireAuth(req, res);
    if (!user) return;

    const organizationId = user.organizationId;

    // GET - List all namespaces for organization
    if (req.method === 'GET') {
      const result = await query(
        `SELECT id, name, sector_nodes, created_at, updated_at 
         FROM namespaces 
         WHERE organization_id = $1 
         ORDER BY created_at DESC`,
        [organizationId]
      );

      return res.status(200).json({ namespaces: result.rows });
    }

    // POST - Create new namespace
    if (req.method === 'POST') {
      const { name, sectorNodes } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Namespace name is required' });
      }

      // Validate namespace name format (alphanumeric, underscores, hyphens)
      if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
        return res.status(400).json({ 
          error: 'Namespace name must contain only letters, numbers, underscores, and hyphens' 
        });
      }

      // Check if namespace already exists for this org
      const existingResult = await query(
        'SELECT id FROM namespaces WHERE organization_id = $1 AND name = $2',
        [organizationId, name]
      );

      if (existingResult.rows.length > 0) {
        return res.status(409).json({ error: 'Namespace already exists' });
      }

      // Check namespace limit based on plan
      const orgResult = await query(
        'SELECT plan_tier, max_namespaces FROM organizations WHERE id = $1',
        [organizationId]
      );

      const org = orgResult.rows[0];
      const namespaceCountResult = await query(
        'SELECT COUNT(*) as count FROM namespaces WHERE organization_id = $1',
        [organizationId]
      );

      const currentCount = parseInt(namespaceCountResult.rows[0].count);
      if (currentCount >= org.max_namespaces) {
        return res.status(403).json({ 
          error: `Namespace limit reached for ${org.plan_tier} plan (max: ${org.max_namespaces})` 
        });
      }

      // Create namespace
      const sectorNodesJson = sectorNodes ? JSON.stringify(sectorNodes) : null;
      
      const result = await query(
        `INSERT INTO namespaces (organization_id, name, sector_nodes) 
         VALUES ($1, $2, $3) 
         RETURNING id, name, sector_nodes, created_at`,
        [organizationId, name, sectorNodesJson]
      );

      return res.status(201).json({ namespace: result.rows[0] });
    }

    // DELETE - Delete namespace
    if (req.method === 'DELETE') {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: 'Namespace ID is required' });
      }

      // Verify namespace belongs to organization
      const result = await query(
        'DELETE FROM namespaces WHERE id = $1 AND organization_id = $2 RETURNING id',
        [id, organizationId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Namespace not found' });
      }

      return res.status(200).json({ message: 'Namespace deleted successfully' });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Namespaces API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
