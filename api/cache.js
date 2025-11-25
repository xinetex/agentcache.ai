export const config = { runtime: 'nodejs' };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
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

function stableKey({ provider, model, messages, temperature = 0.7, namespace = null }) {
  const data = { provider, model, messages, temperature };
  const text = JSON.stringify(data);
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then((buf) => {
    const hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    const ns = namespace ? `${namespace}:` : '';
    return `agentcache:v1:${ns}${provider}:${model}:${hex}`;
  });
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function auth(req) {
  const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '');
  if (!apiKey || !apiKey.startsWith('ac_')) return { ok: false };
  if (apiKey.startsWith('ac_demo_')) return { ok: true, kind: 'demo', hash: null, quota: 200 };
  // verify live key via hash lookup
  const hash = await sha256Hex(apiKey);
  const res = await fetch(`${getEnv().url}/hget/key:${hash}/email`, { headers: { Authorization: `Bearer ${getEnv().token}` }, cache: 'no-store' });
  if (!res.ok) return { ok: false };
  const email = await res.text();
  if (!email) return { ok: false };
  return { ok: true, kind: 'live', hash, email };
}

// Helper to stream cached response (OpenAI-compatible SSE)
function streamCachedResponse(text, model) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Split text into chunks (simulating token stream)
      // We split by spaces to preserve words, but could be finer
      const chunks = text.split(/(\s+)/);
      const timestamp = Math.floor(Date.now() / 1000);
      const id = `cache-${Date.now()}`;

      for (const chunk of chunks) {
        if (!chunk) continue;

        const event = {
          id,
          object: 'chat.completion.chunk',
          created: timestamp,
          model: model,
          choices: [{
            index: 0,
            delta: { content: chunk },
            finish_reason: null
          }]
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      // Final chunk
      const endEvent = {
        id,
        object: 'chat.completion.chunk',
        created: timestamp,
        model: model,
        choices: [{
          index: 0,
          delta: {},
          finish_reason: 'stop'
        }]
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(endEvent)}\n\n`));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      'connection': 'keep-alive',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'Content-Type, Authorization, X-API-Key, X-Cache-Namespace',
    }
  });
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return json({ ok: true });
  }

  try {
    const authn = await auth(req);
    if (!authn.ok) return json({ error: 'Invalid API key' }, 401);

    // Extract namespace from header (for multi-tenant support)
    const namespace = req.headers.get('x-cache-namespace') || null;

    // Rate limiting: Check request count in last minute
    if (authn.kind === 'live' || authn.kind === 'demo') {
      const rateLimitKey = `ratelimit:${authn.hash || 'demo'}:${Math.floor(Date.now() / 60000)}`;
      const rateLimit = authn.kind === 'demo' ? 100 : 500; // requests per minute
      const reqCount = await redis('INCR', rateLimitKey);
      await redis('EXPIRE', rateLimitKey, 120);
      if (Number(reqCount) > rateLimit) {
        return json({ error: 'Rate limit exceeded', limit: rateLimit, window: '1 minute' }, 429);
      }
    }

    const body = await req.json();
    const { key, value, provider, model, messages, temperature, response, ttl = 60 * 60 * 24 * 7, stream = false, semantic = false, similarity_threshold = 0.95 } = body || {};

    // Robotics/Direct Mode: Use provided key
    let cacheKey = key;

    // LLM Mode: Generate stable key if not provided
    if (!cacheKey) {
      if (!provider || !model || !Array.isArray(messages)) return json({ error: 'Invalid payload: provider, model, and messages are required' }, 400);
      cacheKey = await stableKey({ provider, model, messages, temperature, namespace });
    }

    // Normalize 'value' to 'response' for internal logic
    const finalResponse = value ? JSON.stringify(value) : response;

    // Semantic Cache Placeholder Logic (Feature Flagged)
    if (semantic) {
      // In the future, this will:
      // 1. Generate embedding for messages
      // 2. Query Vector DB
      // 3. Return if similarity > threshold
      // For now, return 501 Not Implemented but acknowledging the flag
      if (!process.env.UPSTASH_VECTOR_REST_URL) {
        // Fallback silently to exact match if not configured
        // Or we could return a warning header
      }
    }

    // simple monthly quota for live keys
    if (authn.kind === 'live') {
      const month = new Date().toISOString().slice(0, 7);
      const usageKey = `usage:${authn.hash}:m:${month}`;
      const quotaKey = `usage:${authn.hash}/monthlyQuota`;
      const quota = await redis('GET', quotaKey) || '10000';
      const count = await redis('INCR', usageKey);
      await redis('EXPIRE', usageKey, 60 * 60 * 24 * 40);

      // Check for quota warnings (80%, 90%, 100%)
      const quotaPercent = (Number(count) / Number(quota)) * 100;
      if (quotaPercent >= 80 && quotaPercent < 81) {
        // Trigger webhook: quota.warning at 80%
        try {
          await fetch(`${new URL(req.url).origin}/api/webhooks/trigger`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-internal-trigger': 'true' },
            body: JSON.stringify({
              hash: authn.hash,
              event: 'quota.warning',
              data: { quota: Number(quota), used: Number(count), remaining: Number(quota) - Number(count), percent: quotaPercent }
            })
          }).catch(() => { }); // Fire-and-forget
        } catch (e) { }
      }

      if (Number(count) > Number(quota)) {
        // Trigger webhook: quota.exceeded
        try {
          await fetch(`${new URL(req.url).origin}/api/webhooks/trigger`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-internal-trigger': 'true' },
            body: JSON.stringify({
              hash: authn.hash,
              event: 'quota.exceeded',
              data: { quota: Number(quota), used: Number(count) }
            })
          }).catch(() => { });
        } catch (e) { }
        return json({ error: 'Monthly quota exceeded', quota: Number(quota), used: Number(count) }, 429);
      }
    }

    if (req.method === 'POST' && req.url.endsWith('/set')) {
      if (typeof finalResponse !== 'string') return json({ error: 'response (string) or value (object) is required' }, 400);
      const today = new Date().toISOString().slice(0, 10);
      const metaKey = `${cacheKey}:meta`;

      // Store cached response and metadata
      const commands = [
        ['SETEX', cacheKey, ttl, finalResponse],
        // Store metadata
        ['HSET', metaKey,
          'cachedAt', Date.now(),
          'ttl', ttl * 1000,
          'namespace', namespace || 'default',
          'sourceUrl', req.headers.get('x-source-url') || "",
          'accessCount', 1,
          'lastAccessed', Date.now()
        ],
        ['EXPIRE', metaKey, ttl],
        ['INCR', `stats:global:misses:d:${today}`],
        ['EXPIRE', `stats:global:misses:d:${today}`, 60 * 60 * 24 * 7]
      ];

      if (authn.kind === 'live') {
        commands.push(['HINCRBY', `usage:${authn.hash}`, 'misses', 1]);
      }

      // Execute pipeline
      const { url, token } = getEnv();
      const pipelineRes = await fetch(`${url}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(commands)
      });

      if (!pipelineRes.ok) throw new Error(`Upstash pipeline failed: ${pipelineRes.status}`);

      return json({ success: true, key: cacheKey.slice(-16), ttl });
    }

    if (req.method === 'POST' && req.url.endsWith('/get')) {
      // Fetch cache and metadata in parallel
      const { url, token } = getEnv();
      const metaKey = `${cacheKey}:meta`;

      const pipeline = [
        ['GET', cacheKey],
        ['HGETALL', metaKey]
      ];

      const pipelineRes = await fetch(`${url}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(pipeline)
      });

      if (!pipelineRes.ok) return json({ hit: false }, 404);

      const data = await pipelineRes.json();
      const cachedValue = data[0].result;
      const metaRaw = data[1].result;

      if (!cachedValue) return json({ hit: false }, 404);

      // Parse metadata
      let freshness = null;
      if (metaRaw && metaRaw.length > 0) {
        const metadata = {};
        for (let i = 0; i < metaRaw.length; i += 2) {
          metadata[metaRaw[i]] = metaRaw[i + 1];
        }

        if (metadata.cachedAt) {
          const age = Date.now() - parseInt(metadata.cachedAt);
          const ttlMs = parseInt(metadata.ttl);
          const ttlRemaining = ttlMs - age;

          let status = 'fresh';
          if (age > ttlMs) status = 'expired';
          else if (age > ttlMs * 0.75) status = 'stale';

          freshness = {
            status,
            age,
            ttlRemaining: Math.max(0, ttlRemaining),
            freshnessScore: Math.round((Math.max(0, ttlRemaining) / ttlMs) * 100),
            cachedAt: parseInt(metadata.cachedAt)
          };

          // Update access stats asynchronously
          redis('HINCRBY', metaKey, 'accessCount', 1).catch(() => { });
          redis('HSET', metaKey, 'lastAccessed', Date.now()).catch(() => { });
        }
      }

      // Track global stats and estimate tokens (rough: ~4 chars = 1 token)
      const today = new Date().toISOString().slice(0, 10);
      const estimatedTokens = Math.floor(cachedValue.length / 4);

      // Fire and forget stats updates to reduce latency
      const statsCommands = [
        ['INCR', `stats:global:hits:d:${today}`],
        ['EXPIRE', `stats:global:hits:d:${today}`, 60 * 60 * 24 * 7],
        ['INCRBY', `stats:global:tokens:d:${today}`, estimatedTokens],
        ['EXPIRE', `stats:global:tokens:d:${today}`, 60 * 60 * 24 * 7]
      ];

      if (authn.kind === 'live') {
        statsCommands.push(['HINCRBY', `usage:${authn.hash}`, 'hits', 1]);
      }

      fetch(`${url}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(statsCommands)
      }).catch(() => { });

      if (stream) {
        return streamCachedResponse(cachedValue, model);
      }

      return json({ hit: true, response: cachedValue, freshness });
    }

    if (req.method === 'POST' && req.url.endsWith('/check')) {
      const exists = await redis('EXISTS', cacheKey);
      const ttlVal = await redis('TTL', cacheKey);
      return json({ cached: !!exists, ttl: ttlVal || 0 });
    }

    return json({ error: 'Not found' }, 404);
  } catch (err) {
    return json({ error: 'Unexpected error', details: err?.message || String(err) }, 500);
  }
}
