/**
 * API Key Validation Middleware for Multi-Tenant Cache Endpoints
 * Enforces organization-scoped access and namespace isolation
 */

import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';

const sql = neon(process.env.DATABASE_URL);

/**
 * Validate API key and extract organization context
 * @param {string} apiKey - API key from X-API-Key header
 * @returns {Promise<Object>} Organization and allowed namespaces
 * @throws {Error} if API key is invalid or inactive
 */
export async function validateApiKey(apiKey) {
  if (!apiKey) {
    throw new Error('API key required');
  }

  // Hash the provided key
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

  // Look up API key with organization data
  const results = await sql`
    SELECT 
      ak.id as api_key_id,
      ak.organization_id,
      ak.allowed_namespaces,
      ak.is_active as key_active,
      ak.name as key_name,
      o.id as org_id,
      o.name as org_name,
      o.slug as org_slug,
      o.status as org_status,
      o.plan_tier
    FROM api_keys ak
    JOIN organizations o ON ak.organization_id = o.id
    WHERE ak.key_hash = ${keyHash}
    LIMIT 1
  `;

  if (results.length === 0) {
    throw new Error('Invalid API key');
  }

  const apiKeyData = results[0];

  // Check if key is active
  if (!apiKeyData.key_active) {
    throw new Error('API key is inactive');
  }

  // Check if organization is active
  if (apiKeyData.org_status !== 'active') {
    throw new Error(`Organization is ${apiKeyData.org_status}`);
  }

  return {
    apiKeyId: apiKeyData.api_key_id,
    organizationId: apiKeyData.organization_id,
    organizationName: apiKeyData.org_name,
    organizationSlug: apiKeyData.org_slug,
    planTier: apiKeyData.plan_tier,
    allowedNamespaces: apiKeyData.allowed_namespaces || [],
    keyName: apiKeyData.key_name
  };
}

/**
 * Validate namespace access for an API key
 * @param {Object} keyContext - Result from validateApiKey()
 * @param {string} namespace - Namespace to access
 * @throws {Error} if namespace access is not allowed
 */
export function validateNamespaceAccess(keyContext, namespace) {
  if (!namespace) {
    throw new Error('Namespace header (X-Cache-Namespace) required');
  }

  const allowedNamespaces = keyContext.allowedNamespaces;

  // If no restrictions (empty array or null), allow all
  if (!allowedNamespaces || allowedNamespaces.length === 0) {
    return true;
  }

  // Check if namespace is in allowed list
  if (!allowedNamespaces.includes(namespace)) {
    throw new Error(`Access denied to namespace: ${namespace}. Allowed: ${allowedNamespaces.join(', ')}`);
  }

  return true;
}

/**
 * Middleware wrapper for cache endpoints
 * Validates API key and namespace, attaches context to request
 * @param {Function} handler - Route handler function
 * @returns {Function} Wrapped handler with validation
 */
export function withApiKeyAuth(handler) {
  return async (req, res) => {
    try {
      // Extract API key from header
      const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

      if (!apiKey) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'API key must be provided in X-API-Key or Authorization header'
        });
      }

      // Validate API key
      const keyContext = await validateApiKey(apiKey);

      // Extract namespace from header
      const namespace = req.headers['x-cache-namespace'];

      // Validate namespace access
      try {
        validateNamespaceAccess(keyContext, namespace);
      } catch (error) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: error.message
        });
      }

      // Attach context to request
      req.apiKeyContext = keyContext;
      req.namespace = namespace;

      // Update last used timestamp for namespace
      updateNamespaceLastUsed(keyContext.organizationId, namespace).catch(err => {
        console.error('Failed to update namespace last_used_at:', err);
      });

      // Call original handler
      return handler(req, res);

    } catch (error) {
      console.error('API key validation error:', error);
      
      return res.status(401).json({
        success: false,
        error: 'Authentication failed',
        message: error.message
      });
    }
  };
}

/**
 * Update namespace last_used_at timestamp
 * @param {string} organizationId - Organization UUID
 * @param {string} namespaceName - Namespace name
 */
async function updateNamespaceLastUsed(organizationId, namespaceName) {
  try {
    await sql`
      UPDATE namespaces
      SET 
        last_used_at = NOW(),
        request_count = request_count + 1
      WHERE organization_id = ${organizationId}
        AND name = ${namespaceName}
    `;
  } catch (error) {
    // Non-critical, log but don't throw
    console.warn('Could not update namespace usage:', error.message);
  }
}

/**
 * Increment organization usage metrics
 * @param {string} organizationId - Organization UUID
 * @param {string} namespace - Namespace name
 * @param {Object} metrics - Usage metrics
 */
export async function recordUsage(organizationId, namespace, metrics) {
  try {
    // Find namespace ID
    const namespaces = await sql`
      SELECT id FROM namespaces
      WHERE organization_id = ${organizationId} AND name = ${namespace}
      LIMIT 1
    `;

    const namespaceId = namespaces[0]?.id;

    if (!namespaceId) {
      console.warn(`Namespace not found for usage recording: ${namespace}`);
      return;
    }

    // Insert or update usage metrics
    await sql`
      INSERT INTO organization_usage_metrics (
        organization_id,
        namespace_id,
        timestamp,
        date,
        cache_requests,
        cache_hits,
        cache_misses,
        tokens_processed,
        cost_baseline,
        cost_agentcache,
        cost_saved
      ) VALUES (
        ${organizationId},
        ${namespaceId},
        NOW(),
        CURRENT_DATE,
        ${metrics.requests || 1},
        ${metrics.hits || 0},
        ${metrics.misses || 0},
        ${metrics.tokens || 0},
        ${metrics.costBaseline || 0},
        ${metrics.costAgentCache || 0},
        ${metrics.costSaved || 0}
      )
      ON CONFLICT (organization_id, namespace_id, date)
      DO UPDATE SET
        cache_requests = organization_usage_metrics.cache_requests + EXCLUDED.cache_requests,
        cache_hits = organization_usage_metrics.cache_hits + EXCLUDED.cache_hits,
        cache_misses = organization_usage_metrics.cache_misses + EXCLUDED.cache_misses,
        tokens_processed = organization_usage_metrics.tokens_processed + EXCLUDED.tokens_processed,
        cost_baseline = organization_usage_metrics.cost_baseline + EXCLUDED.cost_baseline,
        cost_agentcache = organization_usage_metrics.cost_agentcache + EXCLUDED.cost_agentcache,
        cost_saved = organization_usage_metrics.cost_saved + EXCLUDED.cost_saved
    `;
  } catch (error) {
    console.error('Failed to record usage metrics:', error);
  }
}

/**
 * Helper to extract API key context from request
 * Use after withApiKeyAuth middleware
 */
export function getApiKeyContext(req) {
  return req.apiKeyContext || null;
}

/**
 * Helper to get namespace from request
 * Use after withApiKeyAuth middleware
 */
export function getNamespace(req) {
  return req.namespace || null;
}

export default {
  validateApiKey,
  validateNamespaceAccess,
  withApiKeyAuth,
  recordUsage,
  getApiKeyContext,
  getNamespace
};
