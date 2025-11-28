/**
 * Tool/Function Call Caching API
 * 
 * Cache results of tool/function calls for agents
 * Use cases: API calls, file operations, computations, external services
 */

export const config = { runtime: 'nodejs' };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, GET, OPTIONS',
      'access-control-allow-headers': 'Content-Type, Authorization, X-API-Key, X-Cache-Namespace',
    },
  });
}

const getEnv = () => ({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function redis(command, ...args) {
  const { url, token } = getEnv();
  if (!url || !token) throw new Error('Upstash not configured');
  const path = `${command}/${args.map(encodeURIComponent).join('/')}`;
  const res = await fetch(`${url}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  const data = await res.json();
  return data.result;
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function auth(req) {
  const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '');
  if (!apiKey || !apiKey.startsWith('ac_')) return { ok: false };
  if (apiKey.startsWith('ac_demo_')) return { ok: true, kind: 'demo', hash: null };
  const hash = await sha256Hex(apiKey);
  const res = await fetch(`${getEnv().url}/hget/key:${hash}/email`, {
    headers: { Authorization: `Bearer ${getEnv().token}` },
    cache: 'no-store'
  });
  if (!res.ok) return { ok: false };
  const email = await res.text();
  if (!email) return { ok: false };
  return { ok: true, kind: 'live', hash, email };
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return json({ ok: true });
  }

  try {
    const authn = await auth(req);
    if (!authn.ok) return json({ error: 'Invalid API key' }, 401);

    const namespace = req.headers.get('x-cache-namespace') || 'default';
    const body = await req.json();
    const { tool_name, parameters, result, ttl = 3600, version = 'v1' } = body || {};

    if (!tool_name) {
      return json({ error: 'tool_name is required' }, 400);
    }

    // Generate stable cache key
    const paramHash = await sha256Hex(JSON.stringify(parameters || {}));
    const cacheKey = `agentcache:tool:${version}:${namespace}:${tool_name}:${paramHash}`;

    // GET: Check if tool result is cached
    if (req.method === 'GET' || req.url.includes('/get')) {
      const startTime = Date.now();
      
      // Check Redis
      const cached = await redis('GET', cacheKey);
      const latency = Date.now() - startTime;

      if (!cached) {
        return json({ hit: false, cache_key: cacheKey.slice(-16) }, 404);
      }

      // Parse cached result
      let parsedResult;
      try {
        parsedResult = JSON.parse(cached);
      } catch {
        parsedResult = cached;
      }

      // Get metadata
      const metaKey = `${cacheKey}:meta`;
      const metaRaw = await redis('HGETALL', metaKey);
      let metadata = {};
      if (metaRaw && metaRaw.length > 0) {
        for (let i = 0; i < metaRaw.length; i += 2) {
          metadata[metaRaw[i]] = metaRaw[i + 1];
        }
      }

      // Update access stats
      redis('HINCRBY', metaKey, 'access_count', 1).catch(() => {});
      redis('HSET', metaKey, 'last_accessed', Date.now()).catch(() => {});

      // Track global tool cache hits
      const today = new Date().toISOString().slice(0, 10);
      redis('INCR', `stats:tool:hits:d:${today}`).catch(() => {});
      redis('EXPIRE', `stats:tool:hits:d:${today}`, 60 * 60 * 24 * 7).catch(() => {});

      return json({
        hit: true,
        result: parsedResult,
        cached_at: parseInt(metadata.cached_at) || null,
        access_count: parseInt(metadata.access_count) || 1,
        latency,
        cache_key: cacheKey.slice(-16),
      });
    }

    // POST: Store tool result in cache
    if (req.method === 'POST' || req.url.includes('/set')) {
      if (result === undefined) {
        return json({ error: 'result is required for caching' }, 400);
      }

      const today = new Date().toISOString().slice(0, 10);
      const metaKey = `${cacheKey}:meta`;
      
      // Serialize result
      const serializedResult = typeof result === 'string' ? result : JSON.stringify(result);

      // Store in Redis with pipeline
      const commands = [
        ['SETEX', cacheKey, ttl, serializedResult],
        ['HSET', metaKey,
          'tool_name', tool_name,
          'namespace', namespace,
          'cached_at', Date.now(),
          'ttl', ttl * 1000,
          'access_count', 1,
          'last_accessed', Date.now(),
          'version', version
        ],
        ['EXPIRE', metaKey, ttl],
        ['INCR', `stats:tool:sets:d:${today}`],
        ['EXPIRE', `stats:tool:sets:d:${today}`, 60 * 60 * 24 * 7]
      ];

      if (authn.kind === 'live') {
        commands.push(['HINCRBY', `usage:${authn.hash}:tool`, 'sets', 1]);
      }

      const { url, token } = getEnv();
      const pipelineRes = await fetch(`${url}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(commands)
      });

      if (!pipelineRes.ok) {
        throw new Error(`Upstash pipeline failed: ${pipelineRes.status}`);
      }

      return json({
        success: true,
        cache_key: cacheKey.slice(-16),
        ttl,
        tool_name,
      });
    }

    return json({ error: 'Invalid method' }, 405);
  } catch (err) {
    console.error('Tool cache error:', err);
    return json({
      error: 'Unexpected error',
      details: err?.message || String(err)
    }, 500);
  }
}
