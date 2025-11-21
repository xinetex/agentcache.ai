/**
 * OpenAI-Compatible Proxy Endpoint
 * 
 * Drop-in replacement for OpenAI API with automatic caching.
 * Agents just change: OPENAI_BASE_URL=https://agentcache.ai
 * 
 * Flow:
 * 1. Receive OpenAI-format request
 * 2. Check cache (SHA-256 hash of messages + model + temperature)
 * 3. Return cached response if exists (with X-Cache: HIT header)
 * 4. On miss: proxy to real OpenAI API OR RouteLLM
 * 5. Store response in cache
 * 6. Return to agent
 */

export const config = { runtime: 'edge' };

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
  const { model, messages, temperature = 1.0, top_p, frequency_penalty, presence_penalty } = request;

  const cacheInput = {
    model,
    messages,
    temperature,
    top_p,
    frequency_penalty,
    presence_penalty
  };

  const msgString = JSON.stringify(cacheInput);
  const msgBuffer = new TextEncoder().encode(msgString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return `agentcache:v1:openai:${model}:${hashHex}`;
}

// Helper: Authenticate API key
async function authenticate(req) {
  // Get API key from header (OpenAI format or AgentCache format)
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

      // Calculate cryptographic proof (SHA-256 of response body)
      const responseString = JSON.stringify(response);
      const proofBuffer = new TextEncoder().encode(responseString);
      const proofHashBuffer = await crypto.subtle.digest('SHA-256', proofBuffer);
      const proofHashArray = Array.from(new Uint8Array(proofHashBuffer));
      const proofHash = proofHashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Return cached response with OpenAI format + cache headers
      return json(response, 200, {
        'X-Cache': 'HIT',
        'X-Cache-Latency': `${latency}ms`,
        'X-AgentCache-Savings': '90%',
        'X-AgentCache-Hash': proofHash
      });
    }

    // Cache MISS - proxy to upstream provider
    let upstreamUrl = 'https://api.openai.com/v1/chat/completions';
    let upstreamKey = req.headers.get('x-openai-key');
    let provider = 'openai';

    // RouteLLM Integration
    if (body.model === 'route-llm') {
      upstreamUrl = 'https://routellm.abacus.ai/v1/chat/completions';
      upstreamKey = req.headers.get('x-abacus-key') || process.env.ABACUS_API_KEY;
      provider = 'routellm';

      if (!upstreamKey) {
        return json({
          error: 'Missing Abacus API Key',
          message: 'Include your Abacus API key as: X-Abacus-Key: ... or configure ABACUS_API_KEY env var'
        }, 400);
      }
    } else {
      // Default to OpenAI
      if (!upstreamKey) {
        return json({
          error: 'Missing X-OpenAI-Key header',
          message: 'Include your OpenAI API key as: X-OpenAI-Key: sk-...'
        }, 400);
      }
    }

    // Proxy request
    const upstreamResponse = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${upstreamKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!upstreamResponse.ok) {
      const errorData = await upstreamResponse.json();
      return json({
        error: `${provider} API error`,
        details: errorData
      }, upstreamResponse.status);
    }

    const upstreamData = await upstreamResponse.json();
    const totalLatency = Date.now() - startTime;

    // Store in cache (7 days TTL)
    const ttl = 7 * 24 * 60 * 60; // 7 days
    await redis('SETEX', cacheKey, ttl, JSON.stringify(upstreamData));

    // Track metrics
    if (auth.kind === 'live') {
      await trackCacheMetrics(auth.hash, false);
      await incrementUsage(auth.hash);
    }

    // Calculate cryptographic proof (SHA-256 of response body)
    const responseString = JSON.stringify(upstreamData);
    const proofBuffer = new TextEncoder().encode(responseString);
    const proofHashBuffer = await crypto.subtle.digest('SHA-256', proofBuffer);
    const proofHashArray = Array.from(new Uint8Array(proofHashBuffer));
    const proofHash = proofHashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Return response with cache headers
    return json(upstreamData, 200, {
      'X-Cache': 'MISS',
      'X-Cache-Latency': `${totalLatency}ms`,
      'X-AgentCache-Provider': provider,
      'X-AgentCache-Hash': proofHash
    });

  } catch (err) {
    console.error('Proxy error:', err);
    return json({
      error: 'Internal server error',
      details: err.message
    }, 500);
  }
}
