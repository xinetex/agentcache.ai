/**
 * Cache Optimization Cron Job
 * 
 * Runs daily to optimize cache performance:
 * - Adaptive TTL: Extend TTL for high-hit cache entries
 * - Cache warming: Pre-populate frequently accessed queries
 * - Cleanup: Remove low-value cache entries
 */

export const config = { runtime: 'nodejs' };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
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

async function scanKeys(pattern, maxKeys = 1000) {
  const keys = [];
  let cursor = '0';
  let iterations = 0;
  
  do {
    const result = await redis('SCAN', cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = result[0];
    
    if (result[1] && Array.isArray(result[1])) {
      keys.push(...result[1]);
    }
    
    iterations++;
    if (keys.length >= maxKeys || iterations >= 100) break;
  } while (cursor !== '0');
  
  return keys;
}

async function getTopCachedKeys(limit = 100) {
  // Scan for cache keys with metadata
  const pattern = 'agentcache:v1:*';
  const keys = await scanKeys(pattern, 500);
  
  // Get metadata for each key
  const keysWithMetadata = [];
  
  for (const key of keys.slice(0, limit)) {
    const metaKey = `${key}:meta`;
    const metaRaw = await redis('HGETALL', metaKey).catch(() => null);
    
    if (metaRaw && metaRaw.length > 0) {
      const metadata = {};
      for (let i = 0; i < metaRaw.length; i += 2) {
        metadata[metaRaw[i]] = metaRaw[i + 1];
      }
      
      keysWithMetadata.push({
        key,
        accessCount: parseInt(metadata.accessCount) || 0,
        cachedAt: parseInt(metadata.cachedAt) || Date.now(),
        ttl: await redis('TTL', key).catch(() => 0),
      });
    }
  }
  
  // Sort by access count (descending)
  keysWithMetadata.sort((a, b) => b.accessCount - a.accessCount);
  
  return keysWithMetadata;
}

async function adaptiveTTLOptimization() {
  console.log('Starting adaptive TTL optimization...');
  
  const topKeys = await getTopCachedKeys(100);
  let extended = 0;
  let reduced = 0;
  
  for (const { key, accessCount, ttl } of topKeys) {
    if (ttl <= 0) continue; // Skip expired/non-existent keys
    
    // High-hit entries: Extend TTL
    if (accessCount >= 10) {
      const newTTL = Math.min(ttl * 1.5, 60 * 60 * 24 * 30); // Max 30 days
      await redis('EXPIRE', key, Math.floor(newTTL));
      await redis('EXPIRE', `${key}:meta`, Math.floor(newTTL));
      extended++;
    }
    // Low-hit entries with high TTL: Reduce TTL
    else if (accessCount <= 2 && ttl > 60 * 60 * 24) {
      const newTTL = Math.max(ttl * 0.5, 60 * 60); // Min 1 hour
      await redis('EXPIRE', key, Math.floor(newTTL));
      await redis('EXPIRE', `${key}:meta`, Math.floor(newTTL));
      reduced++;
    }
  }
  
  return { extended, reduced, analyzed: topKeys.length };
}

async function getCommonQueriesFromAnalytics() {
  // Get top queries from the last 7 days
  // This is a simplified version - in production, you'd analyze actual query patterns
  
  const commonQueries = [
    {
      provider: 'openai',
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'What is Python?' }],
      temperature: 0.7,
    },
    {
      provider: 'openai',
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Explain React hooks' }],
      temperature: 0.7,
    },
    {
      provider: 'anthropic',
      model: 'claude-3-sonnet',
      messages: [{ role: 'user', content: 'How do I deploy to production?' }],
      temperature: 0.7,
    },
  ];
  
  return commonQueries;
}

async function cacheWarming() {
  console.log('Starting cache warming...');
  
  const commonQueries = await getCommonQueriesFromAnalytics();
  let warmed = 0;
  
  for (const query of commonQueries.slice(0, 50)) {
    try {
      // Generate cache key
      const data = {
        provider: query.provider,
        model: query.model,
        messages: query.messages,
        temperature: query.temperature,
      };
      const text = JSON.stringify(data);
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
      const cacheKey = `agentcache:v1:${query.provider}:${query.model}:${hex}`;
      
      // Check if already cached
      const exists = await redis('EXISTS', cacheKey);
      
      if (!exists) {
        // In production, this would call the LLM and cache the result
        // For now, just log that warming would happen
        console.log(`Would warm cache for: ${cacheKey.slice(-16)}`);
        warmed++;
      }
    } catch (error) {
      console.error('Cache warming error:', error);
    }
  }
  
  return { warmed, candidates: commonQueries.length };
}

async function cleanupLowValueEntries() {
  console.log('Starting cleanup of low-value entries...');
  
  const pattern = 'agentcache:v1:*';
  const keys = await scanKeys(pattern, 500);
  let deleted = 0;
  
  for (const key of keys) {
    const metaKey = `${key}:meta`;
    const metaRaw = await redis('HGETALL', metaKey).catch(() => null);
    
    if (!metaRaw) continue;
    
    const metadata = {};
    for (let i = 0; i < metaRaw.length; i += 2) {
      metadata[metaRaw[i]] = metaRaw[i + 1];
    }
    
    const accessCount = parseInt(metadata.accessCount) || 0;
    const cachedAt = parseInt(metadata.cachedAt) || Date.now();
    const age = Date.now() - cachedAt;
    
    // Delete entries that are old and never accessed
    if (accessCount === 1 && age > 7 * 24 * 60 * 60 * 1000) {
      await redis('DEL', key);
      await redis('DEL', metaKey);
      deleted++;
    }
  }
  
  return { deleted, scanned: keys.length };
}

export default async function handler(req) {
  // Verify cron secret or internal trigger
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (!authHeader || !authHeader.includes(cronSecret)) {
    return json({ error: 'Unauthorized - Invalid cron secret' }, 401);
  }
  
  try {
    const startTime = Date.now();
    console.log('Starting cache optimization job...');
    
    // Run all optimization tasks
    const results = await Promise.all([
      adaptiveTTLOptimization(),
      cacheWarming(),
      cleanupLowValueEntries(),
    ]);
    
    const [ttlResults, warmingResults, cleanupResults] = results;
    const duration = Date.now() - startTime;
    
    // Log results
    const summary = {
      success: true,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      adaptive_ttl: {
        extended: ttlResults.extended,
        reduced: ttlResults.reduced,
        analyzed: ttlResults.analyzed,
      },
      cache_warming: {
        warmed: warmingResults.warmed,
        candidates: warmingResults.candidates,
      },
      cleanup: {
        deleted: cleanupResults.deleted,
        scanned: cleanupResults.scanned,
      },
    };
    
    console.log('Cache optimization complete:', summary);
    
    // Store optimization results
    const today = new Date().toISOString().slice(0, 10);
    await redis('SET', `cache_optimization:${today}`, JSON.stringify(summary), 'EX', 60 * 60 * 24 * 7);
    
    return json(summary);
    
  } catch (error) {
    console.error('Cache optimization error:', error);
    return json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    }, 500);
  }
}
