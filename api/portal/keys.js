import { getAuthErrorStatus, requireAuth } from '../../lib/auth-middleware.js';
import { query } from '../../lib/db.js';
import {
  generateApiKey,
  getKeyPrefix,
  hashApiKey,
} from '../../lib/workspace-provisioning.js';
import { getUpgradeTargetForInternalPlan } from '../../lib/billing-plans.js';

export default async function handler(req, res) {
  try {
    // Verify authentication
    const user = await requireAuth(req, res);
    if (!user) return;

    const organizationId = user.organizationId;

    if (!organizationId) {
      return res.status(409).json({
        error: 'Organization setup required',
        onboardingRequired: true,
        onboardingUrl: '/onboarding.html'
      });
    }

    // GET - List all API keys for organization
    if (req.method === 'GET') {
      const result = await query(
        `SELECT id, name, key_prefix, created_at, last_used_at, request_count, is_active
         FROM api_keys 
         WHERE organization_id = $1 
         ORDER BY created_at DESC`,
        [organizationId]
      );

      return res.status(200).json({
        apiKeys: result.rows.map((key) => ({
          id: key.id,
          name: key.name || 'API Key',
          preview: key.key_prefix ? `${key.key_prefix}...` : 'hidden',
          createdAt: key.created_at,
          lastUsedAt: key.last_used_at,
          requestCount: parseInt(key.request_count) || 0,
          isActive: key.is_active
        }))
      });
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
        const upgradeTarget = getUpgradeTargetForInternalPlan(org.plan_tier);
        return res.status(403).json({ 
          error: `API key limit reached for ${org.plan_tier} plan (max: ${org.max_api_keys})`,
          upgradeRequired: Boolean(upgradeTarget),
          currentPlan: org.plan_tier,
          recommendedPlan: upgradeTarget?.publicId || null,
          upgradeUrl: upgradeTarget ? `/upgrade.html?plan=${upgradeTarget.publicId}` : '/pricing.html',
          limitType: 'api_keys',
        });
      }

      // Generate new API key
      const apiKey = generateApiKey();
      const hashedKey = hashApiKey(apiKey);
      const keyPrefix = getKeyPrefix(apiKey);
      const allowedNamespaces = JSON.stringify(['*']);
      const scopes = JSON.stringify(['cache:read', 'cache:write']);

      const result = await query(
        `INSERT INTO api_keys (
           organization_id, key_hash, key_prefix, name, allowed_namespaces, scopes, is_active
         ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
         RETURNING id, name, key_prefix, created_at`,
        [organizationId, hashedKey, keyPrefix, 'Portal API Key', allowedNamespaces, scopes, true]
      );

      return res.status(201).json({ 
        apiKey: {
          id: result.rows[0].id,
          name: result.rows[0].name,
          preview: `${result.rows[0].key_prefix}...`,
          createdAt: result.rows[0].created_at
        },
        secret: apiKey,
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
    const authStatus = getAuthErrorStatus(error);
    if (authStatus) {
      return res.status(authStatus).json({ error: error.message });
    }

    console.error('API keys error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
