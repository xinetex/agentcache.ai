/**
 * AgentCache - Cache Invalidation API
 * POST /api/cache/invalidate
 * 
 * Allows clients to invalidate cached responses by pattern, namespace, age, or URL
 */

export const config = {
  runtime: 'edge',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'Content-Type, X-API-Key, X-Cache-Namespace',
    },
  });
}

// Simple authentication
async function authenticate(req) {
  const apiKey = req.headers.get('x-api-key') || 
                 req.headers.get('authorization')?.replace('Bearer ', '');
  
  if (!apiKey || !apiKey.startsWith('ac_')) {
    return { ok: false, error: 'Invalid API key format' };
  }
  
  // Demo keys bypass all checks
  if (apiKey.startsWith('ac_demo_')) {
    return { ok: true, kind: 'demo', hash: 'demo' };
  }
  
  // Live keys: verify via Redis
  const hash = await hashKey(apiKey);
  const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
  const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  const checkRes = await fetch(`${UPSTASH_URL}/exists/key:${hash}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
  });
  const checkData = await checkRes.json();
  
  if (checkData.result !== 1) {
    return { ok: false, error: 'Invalid API key' };
  }
  
  return { ok: true, kind: 'live', hash };
}

async function hashKey(key) {
  const enc = new TextEncoder();
  const data = enc.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

export default async function handler(req) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return json({}, 204);
  }
  
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }
  
  // Authenticate
  const auth = await authenticate(req);
  if (!auth.ok) {
    return json({ error: auth.error || 'Unauthorized' }, 401);
  }
  
  try {
    const body = await req.json();
    const {
      pattern,          // Wildcard pattern (e.g., "competitor-pricing/*")
      namespace,        // Specific namespace
      olderThan,        // Invalidate caches older than X milliseconds
      url,              // Invalidate caches from specific URL
      reason,           // Reason for invalidation (for logging)
      notify = false,   // Send notification (future feature)
      preWarm = false   // Re-cache after invalidation (future feature)
    } = body;
    
    // Validate at least one criterion
    if (!pattern && !namespace && !olderThan && !url) {
      return json({ 
        error: 'Must provide at least one invalidation criterion',
        criteria: ['pattern', 'namespace', 'olderThan', 'url']
      }, 400);
    }
    
    const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
    const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
    
    // Build scan pattern for Redis
    let scanPattern = 'agentcache:v1:';
    
    if (namespace) {
      scanPattern += `${namespace}:`;
    }
    
    if (pattern) {
      // Convert wildcard pattern to Redis pattern
      const redisPattern = pattern.replace(/\*/g, '*');
      scanPattern += redisPattern;
    } else {
      scanPattern += '*';
    }
    
    // Scan for matching keys
    const scanRes = await fetch(`${UPSTASH_URL}/scan/0/match/${encodeURIComponent(scanPattern)}/count/1000`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
    });
    const scanData = await scanRes.json();
    
    let matchingKeys = scanData.result?.[1] || [];
    const namespaces = new Set();
    let invalidated = 0;
    
    // Filter by age or URL if specified
    if (olderThan || url) {
      const filteredKeys = [];
      
      for (const key of matchingKeys) {
        // Get metadata for age/URL filtering
        const metaKey = `${key}:meta`;
        const metaRes = await fetch(`${UPSTASH_URL}/hgetall/${encodeURIComponent(metaKey)}`, {
          headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
        });
        const metaData = await metaRes.json();
        
        if (metaData.result && metaData.result.length > 0) {
          // Parse metadata (Redis HGETALL returns [key, val, key, val, ...])
          const meta = {};
          for (let i = 0; i < metaData.result.length; i += 2) {
            meta[metaData.result[i]] = metaData.result[i + 1];
          }
          
          // Age check
          if (olderThan && meta.cachedAt) {
            const age = Date.now() - parseInt(meta.cachedAt, 10);
            if (age < olderThan) continue;
          }
          
          // URL check
          if (url && meta.sourceUrl !== url) continue;
        }
        
        filteredKeys.push(key);
      }
      
      matchingKeys = filteredKeys;
    }
    
    // Delete matching keys
    if (matchingKeys.length > 0) {
      // Batch delete
      const pipeline = matchingKeys.map(key => ['DEL', key]).concat(
        matchingKeys.map(key => ['DEL', `${key}:meta`])
      );
      
      const deleteRes = await fetch(`${UPSTASH_URL}/pipeline`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${UPSTASH_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(pipeline)
      });
      await deleteRes.json();
      
      invalidated = matchingKeys.length;
      
      // Extract namespaces
      for (const key of matchingKeys) {
        const parts = key.split(':');
        if (parts.length >= 4) {
          namespaces.add(parts[2]);
        }
      }
    }
    
    // Calculate estimated cost impact
    const avgCostPerCache = 0.01; // $0.01 per cache re-generation
    const estimatedCost = invalidated * avgCostPerCache;
    
    // Log invalidation event
    const logKey = `invalidation:${Date.now()}:${auth.hash}`;
    await fetch(`${UPSTASH_URL}/hset/${encodeURIComponent(logKey)}`, {
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([
        'timestamp', Date.now(),
        'apiKeyHash', auth.hash,
        'pattern', pattern || '',
        'namespace', namespace || '',
        'invalidated', invalidated,
        'reason', reason || 'manual'
      ])
    });
    
    // Set TTL on log (30 days)
    await fetch(`${UPSTASH_URL}/expire/${encodeURIComponent(logKey)}/2592000`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
    });
    
    return json({
      success: true,
      invalidated,
      namespaces: Array.from(namespaces),
      estimatedCostImpact: `$${estimatedCost.toFixed(2)}`,
      preWarmed: preWarm ? invalidated : 0,
      reason: reason || 'manual',
      timestamp: Date.now()
    });
    
  } catch (err) {
    console.error('Invalidation error:', err);
    return json({ 
      error: 'Invalidation failed', 
      details: err.message 
    }, 500);
  }
}
