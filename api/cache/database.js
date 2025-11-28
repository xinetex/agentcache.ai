/**
 * Database Query Caching API
 * 
 * Cache database query results for agents
 * Supports schema versioning for automatic invalidation
 */

export const config = { runtime: 'nodejs' };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, GET, DELETE, OPTIONS',
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
    const {
      query,
      params,
      rows,
      db_name,
      schema_version = '1',
      ttl = 300, // Default 5 minutes for DB queries
    } = body || {};

    if (!db_name) {
      return json({ error: 'db_name is required' }, 400);
    }

    // Generate stable cache key with schema version
    const queryData = `${query}:${JSON.stringify(params || {})}:${schema_version}`;
    const queryHash = await sha256Hex(queryData);
    const cacheKey = `agentcache:db:v1:${namespace}:${db_name}:${queryHash}`;

    // GET: Check if query result is cached
    if (req.method === 'GET' || req.url.includes('/get')) {
      if (!query) {
        return json({ error: 'query is required' }, 400);
      }

      const startTime = Date.now();
      
      // Check Redis
      const cached = await redis('GET', cacheKey);
      const latency = Date.now() - startTime;

      if (!cached) {
        return json({ 
          hit: false, 
          cache_key: cacheKey.slice(-16),
          schema_version 
        }, 404);
      }

      // Parse cached rows
      let parsedRows;
      try {
        parsedRows = JSON.parse(cached);
      } catch {
        parsedRows = [];
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

      // Track global DB cache hits
      const today = new Date().toISOString().slice(0, 10);
      redis('INCR', `stats:db:hits:d:${today}`).catch(() => {});
      redis('EXPIRE', `stats:db:hits:d:${today}`, 60 * 60 * 24 * 7).catch(() => {});

      return json({
        hit: true,
        rows: parsedRows,
        row_count: Array.isArray(parsedRows) ? parsedRows.length : 0,
        cached_at: parseInt(metadata.cached_at) || null,
        access_count: parseInt(metadata.access_count) || 1,
        schema_version: metadata.schema_version || '1',
        latency,
        cache_key: cacheKey.slice(-16),
      });
    }

    // POST: Store query result in cache
    if (req.method === 'POST' || req.url.includes('/set')) {
      if (!query || rows === undefined) {
        return json({ error: 'query and rows are required for caching' }, 400);
      }

      const today = new Date().toISOString().slice(0, 10);
      const metaKey = `${cacheKey}:meta`;
      
      // Serialize rows
      const serializedRows = typeof rows === 'string' ? rows : JSON.stringify(rows);
      const rowCount = Array.isArray(rows) ? rows.length : 0;

      // Store in Redis with pipeline
      const commands = [
        ['SETEX', cacheKey, ttl, serializedRows],
        ['HSET', metaKey,
          'db_name', db_name,
          'namespace', namespace,
          'schema_version', schema_version,
          'query_hash', queryHash.slice(0, 16),
          'cached_at', Date.now(),
          'ttl', ttl * 1000,
          'row_count', rowCount,
          'access_count', 1,
          'last_accessed', Date.now()
        ],
        ['EXPIRE', metaKey, ttl],
        ['INCR', `stats:db:sets:d:${today}`],
        ['EXPIRE', `stats:db:sets:d:${today}`, 60 * 60 * 24 * 7],
        // Track schema version for invalidation
        ['SADD', `schema:${namespace}:${db_name}:${schema_version}`, cacheKey],
        ['EXPIRE', `schema:${namespace}:${db_name}:${schema_version}`, ttl + 3600]
      ];

      if (authn.kind === 'live') {
        commands.push(['HINCRBY', `usage:${authn.hash}:db`, 'sets', 1]);
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
        row_count: rowCount,
        schema_version,
      });
    }

    // DELETE: Invalidate queries by pattern or schema version
    if (req.method === 'DELETE' || req.url.includes('/invalidate')) {
      const { pattern, invalidate_schema } = body || {};

      if (invalidate_schema) {
        // Invalidate all queries for a specific schema version
        const schemaKey = `schema:${namespace}:${db_name}:${schema_version}`;
        const cacheKeys = await redis('SMEMBERS', schemaKey);
        
        if (cacheKeys && cacheKeys.length > 0) {
          // Delete all cache keys and their metadata
          const deleteCommands = [];
          for (const key of cacheKeys) {
            deleteCommands.push(['DEL', key]);
            deleteCommands.push(['DEL', `${key}:meta`]);
          }
          deleteCommands.push(['DEL', schemaKey]);

          const { url, token } = getEnv();
          await fetch(`${url}/pipeline`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: JSON.stringify(deleteCommands)
          });

          return json({
            success: true,
            invalidated: cacheKeys.length,
            schema_version,
          });
        }

        return json({ success: true, invalidated: 0 });
      }

      if (pattern) {
        // Pattern-based invalidation (e.g., all queries for a DB)
        const scanPattern = `agentcache:db:v1:${namespace}:${db_name}:${pattern}`;
        
        // Use SCAN to find matching keys
        let cursor = '0';
        let deletedKeys = 0;
        
        do {
          const result = await redis('SCAN', cursor, 'MATCH', scanPattern, 'COUNT', 100);
          cursor = result[0];
          const keys = result[1];
          
          if (keys && keys.length > 0) {
            // Delete keys in batch
            const deleteCommands = keys.flatMap(key => [
              ['DEL', key],
              ['DEL', `${key}:meta`]
            ]);
            
            const { url, token } = getEnv();
            await fetch(`${url}/pipeline`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
              body: JSON.stringify(deleteCommands)
            });
            
            deletedKeys += keys.length;
          }
        } while (cursor !== '0');

        return json({
          success: true,
          invalidated: deletedKeys,
          pattern: scanPattern,
        });
      }

      return json({ error: 'pattern or invalidate_schema required' }, 400);
    }

    return json({ error: 'Invalid method' }, 405);
  } catch (err) {
    console.error('Database cache error:', err);
    return json({
      error: 'Unexpected error',
      details: err?.message || String(err)
    }, 500);
  }
}
