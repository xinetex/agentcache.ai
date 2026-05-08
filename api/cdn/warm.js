export const config = { runtime: 'nodejs' };

const CDN_WARM_MAX_ITEMS = parseInt(process.env.CDN_WARM_MAX_ITEMS || '', 10) || 25;
const CDN_WARM_ITEM_TIMEOUT_MS = parseInt(process.env.CDN_WARM_ITEM_TIMEOUT_MS || '', 10) || 1500;

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, X-Agent-Onboard, X-Agent-Manifest',
      'Access-Control-Expose-Headers': 'Content-Length,Content-Range,X-VideoCache,X-Generated',
      'Cache-Control': 'public, max-age=30, must-revalidate',
    },
  });
}

function collectWarmTargets(paths, outputs, maxItems) {
  const ordered = [];
  const seen = new Set();

  const addTarget = (value) => {
    if (typeof value !== 'string') return;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    ordered.push(trimmed);
  };

  for (const path of Array.isArray(paths) ? paths : []) addTarget(path);
  for (const output of Array.isArray(outputs) ? outputs : []) addTarget(output?.key);

  return {
    targets: ordered.slice(0, maxItems),
    skippedCount: Math.max(0, ordered.length - maxItems),
  };
}

async function warmPathWithTimeout(cache, path) {
  const warmPromise = (typeof cache.warmPath === 'function'
    ? cache.warmPath(path)
    : cache.get(path).then((data) => ({ path, warmed: !!data, skipped: !data, reason: data ? undefined : 'missing' })));

  try {
    return await Promise.race([
      warmPromise,
      new Promise((resolve) => setTimeout(() => resolve({
        path,
        warmed: false,
        skipped: true,
        reason: 'timeout',
      }), CDN_WARM_ITEM_TIMEOUT_MS)),
    ]);
  } catch (error) {
    return {
      path,
      warmed: false,
      skipped: true,
      reason: error?.message || 'warm_failed',
    };
  }
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return jsonResponse({});
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { paths, jobId, outputs } = body || {};
    const cacheModule = await import('../../transcoder-service/videocache.js');
    const getVideoCache =
      cacheModule.getVideoCache ||
      cacheModule.default?.getVideoCache ||
      cacheModule.default;

    if (typeof getVideoCache !== 'function') {
      return jsonResponse({ error: 'Video cache unavailable' }, 500);
    }

    const cache = getVideoCache({
      l1MaxSize: parseInt(process.env.CDN_L1_MAX_SIZE || '', 10) || 100 * 1024 * 1024,
      l1MaxAge: parseInt(process.env.CDN_L1_TTL || '', 10) || 5 * 60 * 1000,
      redisUrl: process.env.REDIS_URL || process.env.KV_URL || undefined,
      l2TTL: parseInt(process.env.CDN_L2_TTL || '', 10) || 3600,
      s3Endpoint: process.env.JETTYTHUNDER_S3_ENDPOINT || process.env.S3_ENDPOINT,
      s3AccessKey: process.env.JETTYTHUNDER_ACCESS_KEY || process.env.S3_ACCESS_KEY,
      s3SecretKey: process.env.JETTYTHUNDER_SECRET_KEY || process.env.S3_SECRET_KEY,
      s3Bucket: process.env.JETTYTHUNDER_BUCKET || 'jettydata-prod',
    });

    const { targets, skippedCount } = collectWarmTargets(paths, outputs, CDN_WARM_MAX_ITEMS);
    const warmed = [];
    const skipped = [];

    for (const path of targets) {
      const result = await warmPathWithTimeout(cache, path);
      if (result?.warmed) {
        warmed.push(path);
      } else {
        skipped.push({
          path,
          reason: result?.reason || 'not_warmed',
        });
      }
    }

    return jsonResponse({
      success: true,
      warmed,
      skipped,
      skippedCount,
      jobId: jobId || null,
      limit: CDN_WARM_MAX_ITEMS,
      source: 'standalone-cdn-warm',
    });
  } catch (error) {
    return jsonResponse({
      error: 'Cache warming failed',
      details: error?.message || String(error),
    }, 500);
  }
}
