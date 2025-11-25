/**
 * Anthropic-Compatible Proxy Endpoint
 * 
 * Drop-in replacement for Anthropic API with automatic caching.
 * Agents just change: ANTHROPIC_BASE_URL=https://agentcache.ai/v1
 * 
 * Flow:
 * 1. Receive Anthropic-format request
 * 2. Check cache (SHA-256 hash of messages + model + temperature)
 * 3. Return cached response if exists (with X-Cache: HIT header)
 * 4. On miss: proxy to real Anthropic API
 * 5. Store response in cache
 * 6. Return to agent
 */

export const config = { runtime: 'nodejs' };

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Helper: JSON response
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers
    },
  });
}

// Helper: Upstash Redis REST API call
async function redis(command, ...args) {
  const response = await fetch(`${UPSTASH_URL}/${command}/${args.join('/')}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
  });
  const data = await response.json();
  return data.result;
}

// Helper: Generate cache key (deterministic hash)
async function generateCacheKey(request) {
  const { model, messages, temperature = 1.0, top_p, top_k } = request;
  
  const cacheInput = {
    model,
    messages,
    temperature,
    top_p,
    top_k
  };
  
  const msgString = JSON.stringify(cacheInput);
  const msgBuffer = new TextEncoder().encode(msgString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `agentcache:v1:anthropic:${model}:${hashHex}`;
}

// Helper: Authenticate API key
async function authenticate(req) {
  // Get API key from header (Anthropic format or AgentCache format)
  let apiKey = req.headers.get('x-api-key');
  
  if (!apiKey) {
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      apiKey = authHeader.replace('Bearer ', '');
    }
  }
  
  if (!apiKey) {
    return { ok: false, error: 'Missing API key' };
  }
  
  // Demo keys (unlimited for testing)
  if (apiKey.startsWith('ac_demo_')) {
    return { ok: true, kind: 'demo', apiKey };
  }
  
  // Live keys (validate via Redis)
  if (!apiKey.startsWith('ac_live_')) {
    return { ok: false, error: 'Invalid API key format' };
  }
  
  const hash = await hashApiKey(apiKey);
  const email = await redis('HGET', `key:${hash}`, 'email');
  
  if (!email) {
    return { ok: false, error: 'Invalid API key' };
  }
  
  // Check quota
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const usageKey = `usage:${hash}:m:${monthKey}`;
  const usage = parseInt(await redis('GET', usageKey) || '0');
  const quota = parseInt(await redis('HGET', `usage:${hash}`, 'monthlyQuota') || '10000');
  
  if (usage >= quota) {
    return { ok: false, error: 'Monthly quota exceeded', quota: { used: usage, limit: quota } };
  }
  
  return { ok: true, kind: 'live', apiKey, hash, email, usage, quota };
}

// Helper: Hash API key
async function hashApiKey(apiKey) {
  const msgBuffer = new TextEncoder().encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper: Increment usage
async function incrementUsage(hash) {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const usageKey = `usage:${hash}:m:${monthKey}`;
  
  // Increment monthly usage
  await redis('INCR', usageKey);
  
  // Set expiry to end of next month
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 1);
  const ttl = Math.floor((nextMonth - now) / 1000);
  await redis('EXPIRE', usageKey, ttl);
}

// Helper: Track cache hit/miss
async function trackCacheMetrics(hash, hit) {
  if (hit) {
    await redis('HINCRBY', `usage:${hash}`, 'hits', 1);
  } else {
    await redis('HINCRBY', `usage:${hash}`, 'misses', 1);
  }
}

// Main handler
export default async function handler(req) {
  // Only POST allowed
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }
  
  // Authenticate
  const auth = await authenticate(req);
  if (!auth.ok) {
    return json({ error: auth.error, quota: auth.quota }, 401);
  }
  
  try {
    // Parse request body
    const body = await req.json();
    
    // Validate required fields
    if (!body.model || !body.messages) {
      return json({ error: 'Missing required fields: model, messages' }, 400);
    }
    
    // Ensure max_tokens is set (required by Anthropic)
    if (!body.max_tokens) {
      body.max_tokens = 4096; // Default
    }
    
    // Generate cache key
    const cacheKey = await generateCacheKey(body);
    
    // Check cache
    const startTime = Date.now();
    const cached = await redis('GET', cacheKey);
    
    if (cached) {
      // Cache HIT
      const latency = Date.now() - startTime;
      
      // Track metrics
      if (auth.kind === 'live') {
        await trackCacheMetrics(auth.hash, true);
        await incrementUsage(auth.hash);
      }
      
      const response = JSON.parse(cached);
      
      // Return cached response with Anthropic format + cache headers
      return json(response, 200, {
        'X-Cache': 'HIT',
        'X-Cache-Latency': `${latency}ms`,
        'X-AgentCache-Savings': '90%'
      });
    }
    
    // Cache MISS - proxy to Anthropic
    
    // Get user's Anthropic API key from headers
    const anthropicKey = req.headers.get('x-anthropic-key');
    if (!anthropicKey) {
      return json({ 
        error: 'Missing X-Anthropic-Key header', 
        message: 'Include your Anthropic API key as: X-Anthropic-Key: sk-ant-...'
      }, 400);
    }
    
    // Proxy request to Anthropic
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    
    if (!anthropicResponse.ok) {
      const errorData = await anthropicResponse.json();
      return json({ 
        error: 'Anthropic API error', 
        details: errorData 
      }, anthropicResponse.status);
    }
    
    const anthropicData = await anthropicResponse.json();
    const totalLatency = Date.now() - startTime;
    
    // Store in cache (7 days TTL)
    const ttl = 7 * 24 * 60 * 60; // 7 days
    await redis('SETEX', cacheKey, ttl, JSON.stringify(anthropicData));
    
    // Track metrics
    if (auth.kind === 'live') {
      await trackCacheMetrics(auth.hash, false);
      await incrementUsage(auth.hash);
    }
    
    // Return Anthropic response with cache headers
    return json(anthropicData, 200, {
      'X-Cache': 'MISS',
      'X-Cache-Latency': `${totalLatency}ms`,
      'X-AgentCache-Provider': 'anthropic'
    });
    
  } catch (err) {
    console.error('Proxy error:', err);
    return json({ 
      error: 'Internal server error', 
      details: err.message 
    }, 500);
  }
}
