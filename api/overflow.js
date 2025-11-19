/**
 * AgentCache Overflow API
 * 
 * Provides cache-as-a-service backend for partner systems (Redis, AWS, Vector DBs, etc)
 * Partners send cache requests when their primary cache misses or overflows
 * 
 * Revenue model: Partners get % of cache revenue, we handle infrastructure
 */

export const config = { runtime: 'edge' };

const HARDCODED_PARTNERS = {
  'redis-labs': { split: 0.30, name: 'Redis Labs', active: true },
  'pinecone': { split: 0.20, name: 'Pinecone', active: true },
  'together-ai': { split: 0.20, name: 'Together.ai', active: true },
  'aws-elasticache': { split: 0.40, name: 'AWS ElastiCache', active: false },
  'azure-cache': { split: 0.40, name: 'Azure Cache', active: false },
};

// Helper to create JSON responses
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'Content-Type, X-Partner-ID, X-Partner-Key'
    },
  });
}

// Validate partner credentials
async function authenticatePartner(req) {
  const partnerId = req.headers.get('x-partner-id');
  const partnerKey = req.headers.get('x-partner-key');
  
  if (!partnerId || !partnerKey) {
    return { ok: false, error: 'Missing partner credentials' };
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  // 1. Lookup partner (Hardcoded first, then Redis)
  let partner = HARDCODED_PARTNERS[partnerId];
  
  if (!partner) {
    // Try dynamic lookup from Redis (created via onboard-partner script)
    try {
      const infoRes = await fetch(`${url}/hgetall/partner:${partnerId}:info`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.json());
      
      if (infoRes.result && infoRes.result.length > 0) {
        // Parse flat array ["key", "val", ...] to object
        const data = {};
        for (let i = 0; i < infoRes.result.length; i += 2) {
          data[infoRes.result[i]] = infoRes.result[i+1];
        }
        
        partner = {
          name: data.name,
          split: parseFloat(data.revenue_share),
          active: data.status === 'active'
        };
      }
    } catch (err) {
      console.error('Partner lookup error:', err);
    }
  }
  
  if (!partner || !partner.active) {
    return { ok: false, error: 'Invalid or inactive partner' };
  }
  
  // 2. Verify partner key against Redis
  const keyHash = await sha256(partnerKey);
  const storedKey = await fetch(`${url}/get/partner:${partnerId}:key`, {
    headers: { Authorization: `Bearer ${token}` }
  }).then(r => r.json());
  
  if (!storedKey.result || storedKey.result !== keyHash) {
    return { ok: false, error: 'Invalid partner key' };
  }
  
  return { ok: true, partner, partnerId };
}

// SHA-256 hash helper
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate cache key from request
async function generateCacheKey(request) {
  const normalized = {
    provider: request.provider,
    model: request.model,
    messages: JSON.stringify(request.messages),
    temperature: request.temperature || 0
  };
  
  const keyString = JSON.stringify(normalized);
  const hash = await sha256(keyString);
  
  const namespace = request.namespace || 'default';
  return `agentcache:v1:${namespace}:${request.provider}:${request.model}:${hash}`;
}

// Main handler
export default async function handler(req) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return json({}, 200);
  }
  
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }
  
  try {
    // Authenticate partner
    const auth = await authenticatePartner(req);
    if (!auth.ok) {
      return json({ error: auth.error }, 401);
    }
    
    const { partner, partnerId } = auth;
    
    // Parse request
    const body = await req.json();
    const { customer_id, original_request, metadata, action } = body;
    
    if (!customer_id || !original_request) {
      return json({ 
        error: 'Missing required fields: customer_id, original_request' 
      }, 400);
    }
    
    // Redis connection
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    
    const startTime = Date.now();
    
    // Handle different actions
    if (action === 'set') {
      // Store cache entry from partner
      const cacheKey = await generateCacheKey(original_request);
      const response = body.response;
      
      if (!response) {
        return json({ error: 'Missing response data for set action' }, 400);
      }
      
      // Store in Redis with 7-day TTL
      await fetch(`${url}/setex/${encodeURIComponent(cacheKey)}/604800/${encodeURIComponent(JSON.stringify(response))}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Track metrics
      await fetch(`${url}/hincrby/partner:${partnerId}:stats/sets/1`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      return json({
        success: true,
        action: 'set',
        cache_key: cacheKey,
        partner: partner.name,
        latency: Date.now() - startTime
      });
    }
    
    // Default action: get (cache lookup)
    const cacheKey = await generateCacheKey(original_request);
    
    // Check cache
    const cached = await fetch(`${url}/get/${encodeURIComponent(cacheKey)}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json());
    
    const latency = Date.now() - startTime;
    
    if (cached.result) {
      // Cache HIT
      const response = JSON.parse(cached.result);
      
      // Track metrics for partner
      await Promise.all([
        fetch(`${url}/hincrby/partner:${partnerId}:stats/hits/1`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${url}/hincrby/partner:${partnerId}:customer:${customer_id}/hits/1`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      
      // Calculate cost saved (approximate)
      const costSaved = estimateCostSaved(original_request);
      const partnerRevenue = costSaved * partner.split;
      
      return json({
        hit: true,
        response: response,
        latency: latency,
        source: 'agentcache-edge',
        metadata: {
          partner: partner.name,
          customer_id: customer_id,
          cache_key: cacheKey,
          original_metadata: metadata
        },
        billing: {
          cost_saved: costSaved,
          partner_revenue: partnerRevenue,
          revenue_split: partner.split
        }
      });
    } else {
      // Cache MISS
      await Promise.all([
        fetch(`${url}/hincrby/partner:${partnerId}:stats/misses/1`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${url}/hincrby/partner:${partnerId}:customer:${customer_id}/misses/1`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      
      return json({
        hit: false,
        latency: latency,
        cache_key: cacheKey,
        message: 'Cache miss - partner should store response via set action',
        metadata: {
          partner: partner.name,
          customer_id: customer_id
        }
      }, 404);
    }
    
  } catch (err) {
    console.error('Overflow API error:', err);
    return json({ 
      error: 'Internal server error', 
      details: err.message 
    }, 500);
  }
}

// Estimate cost saved based on model/tokens
function estimateCostSaved(request) {
  const pricing = {
    'gpt-4': 0.03,
    'gpt-4-turbo': 0.01,
    'gpt-3.5-turbo': 0.002,
    'claude-3-opus': 0.015,
    'claude-3-sonnet': 0.003,
    'claude-3-haiku': 0.0003
  };
  
  const costPer1k = pricing[request.model] || 0.01;
  const estimatedTokens = 300; // average
  
  return (estimatedTokens / 1000) * costPer1k;
}
