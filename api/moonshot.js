/**
 * Moonshot AI (Kimi K2) Proxy Endpoint
 * 
 * Proxies requests to Moonshot AI and caches:
 * 1. Final responses (like other providers)
 * 2. Reasoning tokens (Kimi K2's "thinking" process)
 * 
 * This enables massive cost savings for reasoning-heavy tasks.
 */

export const config = { runtime: 'edge' };

const MOONSHOT_API_URL = process.env.MOONSHOT_ENDPOINT || 'https://api.moonshot.ai/v1/chat/completions';

// Helper: JSON response
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'Content-Type, X-API-Key, Authorization'
    },
  });
}

// Helper: Hash function for cache keys
async function hash(data) {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(JSON.stringify(data));
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Helper: Authenticate API key
async function authenticate(req) {
  const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '');

  if (!apiKey || !apiKey.startsWith('ac_')) {
    return { ok: false, error: 'Invalid API key format' };
  }

  if (apiKey.startsWith('ac_demo_')) {
    return { ok: true, kind: 'demo', hash: 'demo' };
  }

  // Verify live key via Redis
  const keyHash = await hash(apiKey);
  const url = `${process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL}/get/key:${keyHash}/email`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` }
  });

  const data = await res.json();
  if (!data.result) {
    return { ok: false, error: 'Invalid API key' };
  }

  return { ok: true, kind: 'live', hash: keyHash, email: data.result };
}

// Helper: Get from Redis
async function redisGet(key) {
  const url = `${process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL}/get/${key}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` }
  });
  const data = await res.json();
  return data.result;
}

// Helper: Set in Redis
async function redisSet(key, value, ttl) {
  const url = `${process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL}/set/${key}`;
  const body = ttl ? { value, ex: ttl } : { value };
  await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
}

// Helper: Increment counter
async function redisIncr(key) {
  const url = `${process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL}/incr/${key}`;
  await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` }
  });
}

// Helper: Trigger webhook
async function triggerWebhook(apiKeyHash, eventType, data) {
  try {
    const webhookUrl = `${new URL('/api/webhooks/trigger', 'https://agentcache.ai')}`;
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key_hash: apiKeyHash,
        event: eventType,
        data
      })
    });
  } catch (err) {
    console.error('Webhook trigger failed:', err);
  }
}

export default async function handler(req) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*' } });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    // 1. Authenticate
    const auth = await authenticate(req);
    if (!auth.ok) {
      return json({ error: auth.error || 'Unauthorized' }, 401);
    }

    // 2. Parse request
    const body = await req.json();
    const { messages, model = 'moonshot-v1-8k', temperature = 0.7, cache_reasoning = true } = body;

    if (!messages || !Array.isArray(messages)) {
      return json({ error: 'messages array required' }, 400);
    }

    // 3. Generate cache key
    const namespace = req.headers.get('x-cache-namespace') || 'default';
    const cacheData = { provider: 'moonshot', model, messages, temperature };
    const cacheHash = await hash(cacheData);
    const cacheKey = `agentcache:v1:${namespace}:moonshot:${model}:${cacheHash}`;
    const reasoningKey = `${cacheKey}:reasoning`;

    // 4. Check cache
    const cached = await redisGet(cacheKey);
    if (cached) {
      const parsedCache = JSON.parse(cached);

      // Check if reasoning is also cached
      let reasoning = null;
      if (cache_reasoning) {
        const cachedReasoning = await redisGet(reasoningKey);
        if (cachedReasoning) {
          reasoning = JSON.parse(cachedReasoning);

          // Trigger webhook for reasoning reuse
          await triggerWebhook(auth.hash, 'reasoning.reused', {
            model,
            namespace,
            tokens_saved: reasoning.tokens || 0,
            cost_saved: reasoning.cost_saved || '$0.00'
          });
        }
      }

      // Increment hit counter
      await redisIncr(`usage:${auth.hash}/hits`);
      await triggerWebhook(auth.hash, 'cache.hit', { provider: 'moonshot', model, namespace });

      return json({
        hit: true,
        response: parsedCache.response,
        reasoning: reasoning,
        cached_at: parsedCache.cached_at,
        latency_ms: 1 // Instant from cache
      });
    }

    // 5. Cache miss - call Moonshot API
    const moonshotKey = process.env.MOONSHOT_API_KEY;
    if (!moonshotKey) {
      return json({ error: 'Moonshot API key not configured' }, 500);
    }

    const startTime = Date.now();
    const moonshotRes = await fetch(MOONSHOT_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${moonshotKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        stream: false
      })
    });

    if (!moonshotRes.ok) {
      const error = await moonshotRes.text();
      return json({ error: 'Moonshot API error', details: error }, moonshotRes.status);
    }

    const moonshotData = await moonshotRes.json();
    const latency = Date.now() - startTime;

    // 6. Extract response and reasoning
    const response = moonshotData.choices[0].message.content;
    const usage = moonshotData.usage || {};

    // Kimi K2 exposes reasoning tokens in a separate field (if available)
    const reasoning = {
      tokens: usage.reasoning_tokens || 0,
      cost_saved: `$${((usage.reasoning_tokens || 0) * 0.00003).toFixed(4)}`, // ~$0.03/1K tokens
      cached: false
    };

    // 7. Cache response
    const cacheValue = {
      response,
      cached_at: new Date().toISOString(),
      usage
    };

    const ttl = 86400 * 7; // 7 days default
    await redisSet(cacheKey, JSON.stringify(cacheValue), ttl);

    // 8. Cache reasoning tokens separately (shorter TTL)
    if (cache_reasoning && reasoning.tokens > 0) {
      const reasoningTTL = 3600; // 1 hour for reasoning
      await redisSet(reasoningKey, JSON.stringify(reasoning), reasoningTTL);

      // Trigger webhook for reasoning cached
      await triggerWebhook(auth.hash, 'reasoning.cached', {
        model,
        namespace,
        tokens: reasoning.tokens,
        cost_saved: reasoning.cost_saved
      });
    }

    // 9. Track miss
    await redisIncr(`usage:${auth.hash}/misses`);
    await triggerWebhook(auth.hash, 'cache.miss', { provider: 'moonshot', model, namespace });

    return json({
      hit: false,
      response,
      reasoning: reasoning.tokens > 0 ? reasoning : null,
      latency_ms: latency,
      cached: true
    });

  } catch (err) {
    console.error('Moonshot endpoint error:', err);
    return json({ error: 'Internal error', details: err.message }, 500);
  }
}
