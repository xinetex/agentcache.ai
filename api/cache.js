export const config = { runtime: 'edge' };

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
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

async function auth(req) {
  const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '');
  if (!apiKey || !apiKey.startsWith('ac_')) return { ok:false };
  if (apiKey.startsWith('ac_demo_')) return { ok:true, kind:'demo', hash:null, quota:200 };
  // verify live key via hash lookup
  const hash = await sha256Hex(apiKey);
  const res = await fetch(`${getEnv().url}/hget/key:${hash}/email`, { headers: { Authorization:`Bearer ${getEnv().token}` }, cache:'no-store' });
  if (!res.ok) return { ok:false };
  const email = await res.text();
  if (!email) return { ok:false };
  return { ok:true, kind:'live', hash, email };
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
    const { provider, model, messages, temperature, response, ttl = 60 * 60 * 24 * 7 } = body || {};
    if (!provider || !model || !Array.isArray(messages)) return json({ error: 'Invalid payload' }, 400);

    const cacheKey = await stableKey({ provider, model, messages, temperature, namespace });

    // simple monthly quota for live keys
    if (authn.kind === 'live') {
      const month = new Date().toISOString().slice(0,7);
      const usageKey = `usage:${authn.hash}:m:${month}`;
      const quotaKey = `usage:${authn.hash}/monthlyQuota`;
      const quota = await redis('GET', quotaKey) || '10000';
      const count = await redis('INCR', usageKey);
      await redis('EXPIRE', usageKey, 60*60*24*40);
      
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
          }).catch(() => {}); // Fire-and-forget
        } catch (e) {}
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
          }).catch(() => {});
        } catch (e) {}
        return json({ error:'Monthly quota exceeded', quota:Number(quota), used:Number(count) }, 429);
      }
    }

    if (req.method === 'POST' && req.url.endsWith('/set')) {
      if (typeof response !== 'string') return json({ error: 'response (string) is required' }, 400);
      const today = new Date().toISOString().slice(0, 10);
      
      // Store cached response
      await redis('SETEX', cacheKey, ttl, response);
      
      // Track stats
      await redis('INCR', `stats:global:misses:d:${today}`);
      await redis('EXPIRE', `stats:global:misses:d:${today}`, 60*60*24*7);
      
      if (authn.kind === 'live') {
        await redis('HINCRBY', `usage:${authn.hash}`, 'misses', 1);
      }
      
      return json({ success: true, key: cacheKey.slice(-16), ttl });
    }

    if (req.method === 'POST' && req.url.endsWith('/get')) {
      const cachedValue = await redis('GET', cacheKey);
      
      if (!cachedValue) return json({ hit: false }, 404);
      
      // Track global stats and estimate tokens (rough: ~4 chars = 1 token)
      const today = new Date().toISOString().slice(0, 10);
      const estimatedTokens = Math.floor(cachedValue.length / 4);
      
      await redis('INCR', `stats:global:hits:d:${today}`);
      await redis('EXPIRE', `stats:global:hits:d:${today}`, 60*60*24*7);
      await redis('INCRBY', `stats:global:tokens:d:${today}`, estimatedTokens);
      await redis('EXPIRE', `stats:global:tokens:d:${today}`, 60*60*24*7);
      
      if (authn.kind === 'live') {
        await redis('HINCRBY', `usage:${authn.hash}`, 'hits', 1);
      }
      
      return json({ hit: true, response: cachedValue });
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
