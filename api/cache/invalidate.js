/**
 * Cache Invalidation API
 * 
 * Supports pattern-based and tag-based cache invalidation
 * Allows manual cache clearing for specific keys, namespaces, or patterns
 */

export const config = { runtime: 'nodejs' };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, DELETE, OPTIONS',
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

async function scanKeys(pattern, maxKeys = 1000) {
  const keys = [];
  let cursor = '0';
  let iterations = 0;
  const maxIterations = 100; // Prevent infinite loops
  
  do {
    const result = await redis('SCAN', cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = result[0];
    
    if (result[1] && Array.isArray(result[1])) {
      keys.push(...result[1]);
    }
    
    iterations++;
    if (keys.length >= maxKeys || iterations >= maxIterations) {
      break;
    }
  } while (cursor !== '0');
  
  return keys;
}

async function batchDelete(keys) {
  if (!keys || keys.length === 0) return 0;
  
  const { url, token } = getEnv();
  
  // Delete in batches of 100
  const batchSize = 100;
  let deleted = 0;
  
  for (let i = 0; i < keys.length; i += batchSize) {
    const batch = keys.slice(i, i + batchSize);
    const deleteCommands = batch.flatMap(key => [
      ['DEL', key],
      ['DEL', `${key}:meta`]
    ]);
    
    const pipelineRes = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(deleteCommands)
    });
    
    if (pipelineRes.ok) {
      deleted += batch.length;
    }
  }
  
  return deleted;
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return json({ ok: true });
  }

  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return json({ error: 'Method not allowed. Use POST or DELETE.' }, 405);
  }

  try {
    const authn = await auth(req);
    if (!authn.ok) return json({ error: 'Invalid API key' }, 401);

    const namespace = req.headers.get('x-cache-namespace') || 'default';
    const body = await req.json();
    const { pattern, tags, cache_type, provider, model } = body || {};

    const startTime = Date.now();

    // Pattern-based invalidation
    if (pattern) {
      let searchPattern;
      
      // Build pattern based on cache type
      if (cache_type === 'llm' || !cache_type) {
        // LLM cache: agentcache:v1:{namespace}:{provider}:{model}:{hash}
        let patternParts = ['agentcache', 'v1'];
        if (namespace !== 'default') patternParts.push(namespace);
        if (provider) patternParts.push(provider);
        if (model) patternParts.push(model);
        patternParts.push(pattern);
        searchPattern = patternParts.join(':');
      } else if (cache_type === 'tool') {
        // Tool cache: agentcache:tool:v1:{namespace}:{tool_name}:{hash}
        searchPattern = `agentcache:tool:v1:${namespace}:${pattern}`;
      } else if (cache_type === 'db') {
        // DB cache: agentcache:db:v1:{namespace}:{db_name}:{hash}
        searchPattern = `agentcache:db:v1:${namespace}:${pattern}`;
      } else {
        searchPattern = pattern;
      }

      // Find matching keys
      const keys = await scanKeys(searchPattern);
      
      if (keys.length === 0) {
        return json({
          success: true,
          invalidated: 0,
          pattern: searchPattern,
          latency: Date.now() - startTime,
        });
      }

      // Delete keys
      const deleted = await batchDelete(keys);

      // Track invalidation stats
      const today = new Date().toISOString().slice(0, 10);
      redis('INCRBY', `stats:invalidations:d:${today}`, deleted).catch(() => {});
      redis('EXPIRE', `stats:invalidations:d:${today}`, 60 * 60 * 24 * 7).catch(() => {});

      return json({
        success: true,
        invalidated: deleted,
        pattern: searchPattern,
        latency: Date.now() - startTime,
      });
    }

    // Tag-based invalidation
    if (tags && Array.isArray(tags) && tags.length > 0) {
      // Tags are stored as sets in Redis: tag:{namespace}:{tag_name}
      let allKeys = new Set();
      
      for (const tag of tags) {
        const tagKey = `tag:${namespace}:${tag}`;
        const taggedKeys = await redis('SMEMBERS', tagKey);
        
        if (taggedKeys && Array.isArray(taggedKeys)) {
          taggedKeys.forEach(key => allKeys.add(key));
        }
        
        // Delete the tag set itself
        await redis('DEL', tagKey);
      }

      const keysArray = Array.from(allKeys);
      
      if (keysArray.length === 0) {
        return json({
          success: true,
          invalidated: 0,
          tags,
          latency: Date.now() - startTime,
        });
      }

      // Delete all tagged keys
      const deleted = await batchDelete(keysArray);

      // Track invalidation stats
      const today = new Date().toISOString().slice(0, 10);
      redis('INCRBY', `stats:invalidations:d:${today}`, deleted).catch(() => {});
      redis('EXPIRE', `stats:invalidations:d:${today}`, 60 * 60 * 24 * 7).catch(() => {});

      return json({
        success: true,
        invalidated: deleted,
        tags,
        latency: Date.now() - startTime,
      });
    }

    // Namespace-wide invalidation (dangerous, requires confirmation)
    if (body.invalidate_namespace === true && body.confirm === true) {
      const patterns = [
        `agentcache:v1:${namespace}:*`,
        `agentcache:tool:v1:${namespace}:*`,
        `agentcache:db:v1:${namespace}:*`,
      ];

      let totalDeleted = 0;
      
      for (const pattern of patterns) {
        const keys = await scanKeys(pattern, 10000); // Max 10k keys per pattern
        const deleted = await batchDelete(keys);
        totalDeleted += deleted;
      }

      return json({
        success: true,
        invalidated: totalDeleted,
        namespace,
        warning: 'All caches in namespace cleared',
        latency: Date.now() - startTime,
      });
    }

    return json({
      error: 'Invalid request. Provide pattern, tags, or invalidate_namespace=true with confirm=true',
      examples: {
        pattern: { pattern: '*', cache_type: 'llm', provider: 'openai', model: 'gpt-4' },
        tags: { tags: ['user:123', 'session:abc'] },
        namespace: { invalidate_namespace: true, confirm: true }
      }
    }, 400);

  } catch (err) {
    console.error('Cache invalidation error:', err);
    return json({
      error: 'Unexpected error',
      details: err?.message || String(err)
    }, 500);
  }
}
