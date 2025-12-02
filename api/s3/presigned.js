/**
 * S3 Presigned URL Generator
 * 
 * POST /api/s3/presigned
 * 
 * Generates presigned URLs for Seagate Lyve Cloud objects.
 * Requires authentication (API key or AWS Signature V4).
 * 
 * Request body:
 * {
 *   "key": "users/2/AUDIO1.TV.PDF",
 *   "bucket": "jettydata-prod",  // optional, defaults to LYVE_BUCKET
 *   "expires_in": 3600,            // optional, defaults to 1 hour
 *   "method": "GET"                // optional, defaults to GET
 * }
 * 
 * Response:
 * {
 *   "url": "https://s3.us-east-1.lyvecloud.seagate.com/...",
 *   "expires_in": 3600,
 *   "expires_at": "2023-12-01T12:00:00Z"
 * }
 */

export const config = { runtime: 'nodejs' };

import { generatePresignedUrl } from '../../lib/aws-sig-v4.js';
import { authenticate, extractNamespace } from '../../lib/auth-unified.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'Content-Type, Authorization, X-API-Key',
    },
  });
}

/**
 * Redis client for Upstash REST API
 */
function getRedisClient() {
  return {
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
  };
}

export default async function handler(req) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return json({ ok: true });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    // Authenticate request
    const redis = getRedisClient();
    const auth = await authenticate(req, redis);

    if (!auth.ok) {
      return json({ error: auth.error }, auth.status || 401);
    }

    // Parse request body
    const body = await req.json();
    const { key, bucket, expires_in = 3600, method = 'GET' } = body;

    // Validate input
    if (!key) {
      return json({ error: 'Missing required field: key' }, 400);
    }

    // Get Lyve Cloud configuration from environment
    const lyveConfig = {
      accessKeyId: process.env.LYVE_ACCESS_KEY_ID,
      secretAccessKey: process.env.LYVE_SECRET_ACCESS_KEY,
      endpoint: process.env.LYVE_ENDPOINT || 'https://s3.us-east-1.lyvecloud.seagate.com',
      bucket: bucket || process.env.LYVE_BUCKET || 'jettydata-prod',
      region: process.env.LYVE_REGION || 'us-east-1',
    };

    // Validate configuration
    if (!lyveConfig.accessKeyId || !lyveConfig.secretAccessKey) {
      console.error('Missing Lyve Cloud credentials in environment');
      return json({ error: 'Service configuration error' }, 500);
    }

    // Validate region/endpoint consistency
    const endpointRegion = lyveConfig.endpoint.match(/s3\.([^.]+)\.lyvecloud/)?.[1];
    if (endpointRegion && endpointRegion !== lyveConfig.region) {
      console.error(`Region mismatch: endpoint=${endpointRegion}, config=${lyveConfig.region}`);
      return json({
        error: 'Configuration error',
        details: 'Region and endpoint do not match'
      }, 500);
    }

    // Generate presigned URL
    const presignedUrl = generatePresignedUrl({
      method,
      bucket: lyveConfig.bucket,
      key,
      accessKeyId: lyveConfig.accessKeyId,
      secretAccessKey: lyveConfig.secretAccessKey,
      region: lyveConfig.region,
      endpoint: lyveConfig.endpoint,
      expiresIn: expires_in,
    });

    // Calculate expiration timestamp
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    // Track usage (optional analytics)
    const namespace = extractNamespace(req);
    const logKey = `presigned:${auth.key.hash}:${new Date().toISOString().slice(0, 10)}`;

    // Increment counter (fire and forget)
    fetch(`${process.env.UPSTASH_REDIS_REST_URL}/incr/${logKey}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      },
    }).catch(() => { }); // Ignore errors

    return json({
      url: presignedUrl,
      expires_in,
      expires_at: expiresAt,
      bucket: lyveConfig.bucket,
      key,
      method,
    });

  } catch (error) {
    console.error('Presigned URL generation error:', error);
    return json({
      error: 'Internal server error',
      message: error.message
    }, 500);
  }
}
