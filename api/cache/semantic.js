export const config = { runtime: 'edge' };

// L3 Semantic Cache API
// POST /api/cache/semantic
// Uses OpenAI embeddings + cosine similarity for semantic matching
// Feature flag: ENABLE_L3_CACHE

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'Content-Type, X-API-Key, Authorization, X-Cache-Namespace'
    }
  });
}

async function authenticateApiKey(apiKey) {
  if (!apiKey || !apiKey.startsWith('ac_')) {
    return { ok: false, error: 'Invalid API key format' };
  }
  
  // Demo keys
  if (apiKey.startsWith('ac_demo_')) {
    return { ok: true, kind: 'demo', hash: 'demo' };
  }
  
  // Live keys - hash and lookup
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!url || !token) {
    return { ok: false, error: 'Redis not configured' };
  }
  
  // Check if key exists
  const keyCheckRes = await fetch(`${url}/hget/key:${hash}/email`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const keyCheck = await keyCheckRes.json();
  
  if (!keyCheck.result) {
    return { ok: false, error: 'Invalid API key' };
  }
  
  return { ok: true, kind: 'live', hash, email: keyCheck.result };
}

async function generateEmbedding(text) {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    throw new Error('OpenAI API key not configured');
  }
  
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI embeddings failed: ${error}`);
  }
  
  const data = await response.json();
  return data.data[0].embedding;
}

function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have same length');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function searchSemanticCache(embedding, namespace, provider, model, threshold = 0.85) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  // Build namespace prefix
  const nsPrefix = namespace ? `ns:${namespace}:` : '';
  
  // Search for cached embeddings
  // Pattern: semantic:v1:{namespace}:{provider}:{model}:{hash}
  const pattern = `${nsPrefix}semantic:v1:${provider}:${model}:*`;
  
  // Get all semantic cache keys for this provider/model
  const keysRes = await fetch(`${url}/keys/${encodeURIComponent(pattern)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const keysData = await keysRes.json();
  const keys = keysData.result || [];
  
  if (keys.length === 0) {
    return null;
  }
  
  // Fetch embeddings for all keys (batch)
  const commands = keys.map(key => ['HGETALL', key]);
  
  const batchRes = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ commands })
  });
  
  const batchData = await batchRes.json();
  
  // Find best match
  let bestMatch = null;
  let bestScore = 0;
  
  for (let i = 0; i < keys.length; i++) {
    const fields = batchData[i]?.result || [];
    if (fields.length === 0) continue;
    
    // Parse hash fields
    const cached = {};
    for (let j = 0; j < fields.length; j += 2) {
      cached[fields[j]] = fields[j + 1];
    }
    
    if (!cached.embedding) continue;
    
    // Parse embedding
    const cachedEmbedding = JSON.parse(cached.embedding);
    
    // Calculate similarity
    const similarity = cosineSimilarity(embedding, cachedEmbedding);
    
    if (similarity > bestScore && similarity >= threshold) {
      bestScore = similarity;
      bestMatch = {
        key: keys[i],
        response: JSON.parse(cached.response),
        similarity: similarity,
        cached_at: cached.cached_at,
        ttl: cached.ttl
      };
    }
  }
  
  return bestMatch;
}

async function storeSemanticCache(embedding, request, response, namespace) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  // Generate hash of request (for unique key)
  const requestStr = JSON.stringify({
    provider: request.provider,
    model: request.model,
    messages: request.messages
  });
  
  const encoder = new TextEncoder();
  const data = encoder.encode(requestStr);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Build key
  const nsPrefix = namespace ? `ns:${namespace}:` : '';
  const key = `${nsPrefix}semantic:v1:${request.provider}:${request.model}:${hash}`;
  
  // Store in Redis hash
  const ttl = request.ttl || 604800; // 7 days default
  
  const commands = [
    ['HSET', key, 'embedding', JSON.stringify(embedding)],
    ['HSET', key, 'response', JSON.stringify(response)],
    ['HSET', key, 'cached_at', new Date().toISOString()],
    ['HSET', key, 'ttl', ttl.toString()],
    ['EXPIRE', key, ttl]
  ];
  
  await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ commands })
  });
  
  return key;
}

export default async function handler(req) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'Content-Type, X-API-Key, Authorization, X-Cache-Namespace'
      }
    });
  }
  
  // Check feature flag
  if (process.env.ENABLE_L3_CACHE !== 'true') {
    return json({ 
      error: 'Semantic cache not enabled',
      message: 'L3 semantic cache is currently behind a feature flag. Contact support to enable.'
    }, 503);
  }
  
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }
  
  try {
    // Extract API key
    const apiKey = req.headers.get('x-api-key') || 
                   req.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!apiKey) {
      return json({ error: 'Missing API key' }, 401);
    }
    
    // Authenticate
    const auth = await authenticateApiKey(apiKey);
    if (!auth.ok) {
      return json({ error: auth.error || 'Authentication failed' }, 401);
    }
    
    // Parse request
    const body = await req.json();
    const { 
      action,  // 'search' or 'store'
      provider, 
      model, 
      messages, 
      response,
      threshold = 0.85,
      ttl
    } = body;
    
    if (!action || !provider || !model || !messages) {
      return json({ 
        error: 'Missing required fields',
        required: ['action', 'provider', 'model', 'messages']
      }, 400);
    }
    
    // Get namespace
    const namespace = req.headers.get('x-cache-namespace');
    
    // Convert messages to text for embedding
    const messagesText = messages.map(m => 
      `${m.role}: ${m.content}`
    ).join('\n');
    
    const startTime = Date.now();
    
    // Generate embedding
    const embedding = await generateEmbedding(messagesText);
    const embeddingTime = Date.now() - startTime;
    
    if (action === 'search') {
      // Search for semantic match
      const match = await searchSemanticCache(
        embedding, 
        namespace, 
        provider, 
        model,
        threshold
      );
      
      if (match) {
        // Semantic cache hit
        return json({
          hit: true,
          tier: 'L3_SEMANTIC',
          response: match.response,
          similarity: match.similarity,
          threshold: threshold,
          cached_at: match.cached_at,
          latency: {
            total_ms: Date.now() - startTime,
            embedding_ms: embeddingTime,
            search_ms: Date.now() - startTime - embeddingTime
          },
          billing: {
            hit: true,
            cost_saved: 0.045, // avg GPT-4 request cost
            embedding_cost: 0.00001 // text-embedding-3-small cost
          }
        });
      } else {
        // Semantic cache miss
        return json({
          hit: false,
          tier: 'L3_SEMANTIC',
          message: 'No semantically similar cached response found',
          threshold: threshold,
          latency: {
            total_ms: Date.now() - startTime,
            embedding_ms: embeddingTime
          }
        }, 404);
      }
      
    } else if (action === 'store') {
      // Store in semantic cache
      if (!response) {
        return json({ error: 'Missing response to cache' }, 400);
      }
      
      const cacheKey = await storeSemanticCache(
        embedding,
        { provider, model, messages, ttl },
        response,
        namespace
      );
      
      return json({
        cached: true,
        tier: 'L3_SEMANTIC',
        cache_key: cacheKey,
        latency: {
          total_ms: Date.now() - startTime,
          embedding_ms: embeddingTime,
          store_ms: Date.now() - startTime - embeddingTime
        }
      });
      
    } else {
      return json({ 
        error: 'Invalid action',
        valid_actions: ['search', 'store']
      }, 400);
    }
    
  } catch (err) {
    console.error('Semantic cache error:', err);
    return json({ 
      error: 'Semantic cache operation failed',
      details: err.message 
    }, 500);
  }
}
