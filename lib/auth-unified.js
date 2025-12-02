/**
 * Unified Authentication Middleware
 * 
 * Supports three authentication methods:
 * 1. API Key (X-API-Key header) - Current AgentCache system
 * 2. JWT Bearer token - User session authentication
 * 3. AWS Signature V4 - S3-compatible authentication
 */

import { createHash } from 'crypto';
import { verifySignature, extractAccessKeyId } from './aws-sig-v4.js';

/**
 * Detect authentication type from request
 */
export function detectAuthType(req) {
  // Check for API key in X-API-Key header
  const apiKey = req.headers['x-api-key'] || req.headers['X-API-Key'];
  if (apiKey && apiKey.startsWith('ac_')) {
    return 'api_key';
  }

  // Check Authorization header
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      // Check if it's an API key or JWT
      if (token.startsWith('ac_')) {
        return 'api_key';
      }
      return 'jwt';
    }

    if (authHeader.startsWith('AWS4-HMAC-SHA256')) {
      return 'aws_sig_v4';
    }
  }

  // Check for presigned URL (query string auth)
  if (req.url && req.url.includes('X-Amz-Signature=')) {
    return 'aws_sig_v4_presigned';
  }

  return null;
}

/**
 * Authenticate using API key
 * 
 * @param {string} apiKey - API key from request
 * @param {object} redis - Redis client (Upstash REST API format)
 * @returns {object} - Auth result
 */
export async function authenticateApiKey(apiKey, redis) {
  // Validate format
  if (!apiKey || !apiKey.startsWith('ac_')) {
    return { ok: false, error: 'Invalid API key format' };
  }

  // Demo keys (unlimited, no validation)
  if (apiKey.startsWith('ac_demo_')) {
    return {
      ok: true,
      type: 'api_key',
      kind: 'demo',
      key: {
        id: apiKey,
        quota: Infinity,
        usage: 0,
      },
      namespace: null,
    };
  }

  // Live keys - lookup in Redis
  if (!apiKey.startsWith('ac_live_')) {
    return { ok: false, error: 'Invalid API key prefix' };
  }

  try {
    // Hash the key for lookup
    const hash = createHash('sha256').update(apiKey).digest('hex');

    // Check if key exists
    const keyData = await redis.hgetall(`usage:${hash}`);

    if (!keyData || Object.keys(keyData).length === 0) {
      return { ok: false, error: 'Invalid API key' };
    }

    // Get quota and usage
    const quota = parseInt(keyData.monthlyQuota || '0', 10);
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const usage = await redis.get(`usage:${hash}:m:${currentMonth}`) || 0;

    // Get email and tier if available
    const email = await redis.get(`key:${hash}/email`);
    const tier = await redis.get(`tier:${hash}`) || 'free';

    // Set default quota based on tier if not set
    let finalQuota = quota;
    if (finalQuota === 0) {
      finalQuota = tier === 'pro' ? 1000000 : 10000;
    }

    // Check quota
    if (finalQuota > 0 && usage >= finalQuota) {
      return { ok: false, error: 'Quota exceeded', status: 429 };
    }

    return {
      ok: true,
      type: 'api_key',
      kind: 'live',
      key: {
        id: apiKey,
        hash,
        tier,
        quota: finalQuota,
        usage: parseInt(usage, 10),
        email,
      },
      namespace: null,
    };
  } catch (error) {
    console.error('API key auth error:', error);
    return { ok: false, error: 'Authentication failed' };
  }
}

/**
 * Authenticate using AWS Signature V4
 * 
 * @param {Request} req - HTTP request
 * @param {object} redis - Redis client
 * @returns {object} - Auth result
 */
export async function authenticateAwsSigV4(req, redis) {
  try {
    // Extract access key ID
    const accessKeyId = extractAccessKeyId(req);
    if (!accessKeyId) {
      return { ok: false, error: 'Missing AWS access key ID' };
    }

    // Lookup secret key in Redis
    // Format: aws:accesskey:{access_key_id} -> secret_key
    const secretKey = await redis.get(`aws:accesskey:${accessKeyId}`);
    if (!secretKey) {
      return { ok: false, error: 'Invalid AWS credentials' };
    }

    // Verify signature
    const valid = verifySignature(req, secretKey);
    if (!valid) {
      return { ok: false, error: 'Invalid signature' };
    }

    // Get user info associated with this access key
    const userId = await redis.get(`aws:accesskey:${accessKeyId}:user`);
    const email = await redis.get(`aws:accesskey:${accessKeyId}:email`);

    // Get quota/usage
    const hash = createHash('sha256').update(accessKeyId).digest('hex');
    const quota = await redis.get(`usage:${hash}/monthlyQuota`) || 0;
    const currentMonth = new Date().toISOString().slice(0, 7);
    const usage = await redis.get(`usage:${hash}:m:${currentMonth}`) || 0;

    return {
      ok: true,
      type: 'aws_sig_v4',
      user: {
        id: userId,
        email,
      },
      key: {
        id: accessKeyId,
        hash,
        quota: parseInt(quota, 10),
        usage: parseInt(usage, 10),
      },
      namespace: null,
    };
  } catch (error) {
    console.error('AWS Signature V4 auth error:', error);
    return { ok: false, error: 'Authentication failed' };
  }
}

/**
 * Unified authentication function
 * 
 * Detects auth type and authenticates accordingly
 * 
 * @param {Request} req - HTTP request
 * @param {object} redis - Redis client
 * @returns {object} - Auth result
 */
export async function authenticate(req, redis) {
  const authType = detectAuthType(req);

  if (!authType) {
    return { ok: false, error: 'No authentication provided' };
  }

  switch (authType) {
    case 'api_key': {
      const apiKey = req.headers['x-api-key'] ||
        req.headers['X-API-Key'] ||
        req.headers.authorization?.replace('Bearer ', '') ||
        req.headers.Authorization?.replace('Bearer ', '');
      return authenticateApiKey(apiKey, redis);
    }

    case 'aws_sig_v4':
    case 'aws_sig_v4_presigned':
      return authenticateAwsSigV4(req, redis);

    case 'jwt':
      // JWT authentication would go here
      // For now, not implemented in this phase
      return { ok: false, error: 'JWT authentication not yet implemented' };

    default:
      return { ok: false, error: 'Unknown authentication type' };
  }
}

/**
 * Extract namespace from request headers
 */
export function extractNamespace(req) {
  return req.headers['x-cache-namespace'] ||
    req.headers['X-Cache-Namespace'] ||
    null;
}

/**
 * Increment usage for an API key
 */
async function incrementUsage(auth, redis) {
  if (!auth.ok || !auth.key || !auth.key.hash) return;

  const hash = auth.key.hash;
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const key = `usage:${hash}:m:${currentMonth}`;

  try {
    await redis.incr(key);
  } catch (error) {
    console.error('Failed to increment usage:', error);
  }
}

/**
 * Middleware helper for Vercel edge functions
 * 
 * Usage:
 * ```javascript
 * import { withAuth } from '/lib/auth-unified.js';
 * 
 * export default withAuth(async (req, auth) => {
 *   // auth.key.id, auth.user, etc.
 *   return new Response('OK');
 * });
 * ```
 */
export function withAuth(handler) {
  return async (req, context) => {
    // Get Redis config from env
    const redis = {
      get: async (key) => {
        const response = await fetch(
          `${process.env.UPSTASH_REDIS_REST_URL}/get/${key}`,
          {
            headers: {
              Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
            },
          }
        );
        const data = await response.json();
        return data.result;
      },
      hgetall: async (key) => {
        const response = await fetch(
          `${process.env.UPSTASH_REDIS_REST_URL}/hgetall/${key}`,
          {
            headers: {
              Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
            },
          }
        );
        const data = await response.json();

        // Convert array [k1, v1, k2, v2] to object {k1: v1, k2: v2}
        const result = {};
        if (data.result && Array.isArray(data.result)) {
          for (let i = 0; i < data.result.length; i += 2) {
            result[data.result[i]] = data.result[i + 1];
          }
        }
        return result;
      },
      incr: async (key) => {
        const response = await fetch(
          `${process.env.UPSTASH_REDIS_REST_URL}/incr/${key}`,
          {
            headers: {
              Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
            },
          }
        );
        const data = await response.json();
        return data.result;
      }
    };

    // Authenticate
    const auth = await authenticate(req, redis);

    if (!auth.ok) {
      return new Response(
        JSON.stringify({
          error: auth.error,
          message: 'Authentication failed'
        }),
        {
          status: auth.status || 401,
          headers: { 'content-type': 'application/json' },
        }
      );
    }

    // Extract namespace
    auth.namespace = extractNamespace(req);

    // Call handler with authenticated context
    const response = await handler(req, auth);

    // Increment usage asynchronously
    if (response.ok && auth.type === 'api_key') {
      const incrementPromise = incrementUsage(auth, redis);

      if (context && typeof context.waitUntil === 'function') {
        context.waitUntil(incrementPromise);
      } else {
        // Fire and forget for Node.js / non-edge environments
        incrementPromise.catch(err => console.error('Usage increment failed:', err));
      }
    }

    return response;
  };
}
