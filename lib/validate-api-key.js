import { createClient } from '@vercel/postgres';
import crypto from 'crypto';

/**
 * API Key Validation Middleware
 * Validates API keys and enforces namespace access control for cache endpoints
 */

/**
 * Validate API key and check namespace access
 * @param {Request} req - HTTP request object
 * @returns {Promise<Object>} API key details with organization and namespace access
 * @throws {Error} if API key invalid or namespace access denied
 */
export async function validateApiKey(req) {
  // Extract API key from header
  const apiKey = req.headers.get('x-api-key');
  
  if (!apiKey) {
    throw new Error('API key required. Please provide X-API-Key header.');
  }

  // Extract namespace from header (optional for some endpoints)
  const namespace = req.headers.get('x-cache-namespace') || 'default';

  // Hash the API key for database lookup
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

  const client = createClient();

  try {
    await client.connect();

    // Look up API key in database
    const keyResult = await client.query(`
      SELECT 
        ak.*,
        o.id as organization_id,
        o.name as organization_name,
        o.slug as organization_slug,
        o.status as organization_status,
        o.plan_tier
      FROM api_keys ak
      JOIN organizations o ON ak.organization_id = o.id
      WHERE ak.key_hash = $1
    `, [keyHash]);

    if (keyResult.rows.length === 0) {
      throw new Error('Invalid API key');
    }

    const apiKeyData = keyResult.rows[0];

    // Check if API key is active
    if (!apiKeyData.is_active) {
      throw new Error('API key has been revoked');
    }

    // Check if API key has expired
    if (apiKeyData.expires_at && new Date(apiKeyData.expires_at) < new Date()) {
      throw new Error('API key has expired');
    }

    // Check if organization is active
    if (apiKeyData.organization_status !== 'active') {
      throw new Error('Organization account is not active');
    }

    // Parse allowed namespaces
    let allowedNamespaces = [];
    try {
      allowedNamespaces = apiKeyData.allowed_namespaces || [];
    } catch (e) {
      console.error('Failed to parse allowed_namespaces:', e);
      allowedNamespaces = [];
    }

    // Check namespace access
    // '*' means access to all namespaces
    const hasAccess = 
      allowedNamespaces.includes('*') || 
      allowedNamespaces.includes(namespace);

    if (!hasAccess) {
      throw new Error(`Access denied to namespace: ${namespace}`);
    }

    // Verify namespace exists in organization
    const namespaceResult = await client.query(`
      SELECT id, name, is_active
      FROM namespaces
      WHERE organization_id = $1 AND name = $2 AND is_active = true
    `, [apiKeyData.organization_id, namespace]);

    if (namespaceResult.rows.length === 0 && namespace !== 'default') {
      throw new Error(`Namespace not found or inactive: ${namespace}`);
    }

    const namespaceData = namespaceResult.rows[0] || { 
      id: null, 
      name: 'default', 
      is_active: true 
    };

    // Update last_used_at and increment request_count
    await client.query(`
      UPDATE api_keys
      SET 
        last_used_at = NOW(),
        request_count = request_count + 1
      WHERE id = $1
    `, [apiKeyData.id]);

    return {
      apiKeyId: apiKeyData.id,
      apiKeyName: apiKeyData.name,
      organizationId: apiKeyData.organization_id,
      organizationName: apiKeyData.organization_name,
      organizationSlug: apiKeyData.organization_slug,
      planTier: apiKeyData.plan_tier,
      namespace: namespace,
      namespaceId: namespaceData.id,
      allowedNamespaces: allowedNamespaces,
      scopes: apiKeyData.scopes || [],
    };

  } finally {
    await client.end();
  }
}

/**
 * Track usage metrics for organization
 * @param {Object} params - Usage tracking parameters
 * @param {string} params.organizationId - Organization ID
 * @param {string} params.namespaceId - Namespace ID
 * @param {boolean} params.cacheHit - Whether request was a cache hit
 * @param {number} params.tokensProcessed - Number of tokens processed
 * @param {number} params.costBaseline - Baseline cost without cache
 * @param {number} params.costAgentcache - Cost with AgentCache
 */
export async function trackUsage(params) {
  const {
    organizationId,
    namespaceId,
    cacheHit,
    tokensProcessed = 0,
    costBaseline = 0,
    costAgentcache = 0,
  } = params;

  const client = createClient();

  try {
    await client.connect();

    const now = new Date();
    const date = now.toISOString().split('T')[0]; // YYYY-MM-DD

    await client.query(`
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
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      organizationId,
      namespaceId,
      now,
      date,
      1, // cache_requests
      cacheHit ? 1 : 0, // cache_hits
      cacheHit ? 0 : 1, // cache_misses
      tokensProcessed,
      costBaseline,
      costAgentcache,
      costBaseline - costAgentcache, // cost_saved
    ]);

  } catch (error) {
    // Don't fail the request if usage tracking fails
    console.error('Failed to track usage:', error);
  } finally {
    await client.end();
  }
}

/**
 * Create standard error response for API key validation failures
 * @param {string} message - Error message
 * @param {number} status - HTTP status code
 * @returns {Response} JSON error response
 */
export function createApiKeyError(message, status = 401) {
  return new Response(
    JSON.stringify({
      success: false,
      error: message,
      code: status === 401 ? 'INVALID_API_KEY' : 'ACCESS_DENIED',
    }),
    {
      status,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store',
      },
    }
  );
}

/**
 * Wrapper to handle API key validation in route handlers
 * @param {Function} handler - Route handler function that receives validated API key data
 * @returns {Function} Wrapped handler with API key validation
 */
export function withApiKey(handler) {
  return async (req) => {
    try {
      const apiKeyData = await validateApiKey(req);
      return await handler(req, apiKeyData);
    } catch (error) {
      if (error.message.includes('API key required') ||
          error.message.includes('Invalid API key') ||
          error.message.includes('revoked') ||
          error.message.includes('expired')) {
        return createApiKeyError(error.message, 401);
      }
      if (error.message.includes('Access denied') ||
          error.message.includes('not active') ||
          error.message.includes('not found')) {
        return createApiKeyError(error.message, 403);
      }
      // Other errors
      console.error('API key validation error:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Internal server error',
        }),
        {
          status: 500,
          headers: { 'content-type': 'application/json' },
        }
      );
    }
  };
}

export default {
  validateApiKey,
  trackUsage,
  createApiKeyError,
  withApiKey,
};
