export const config = { runtime: 'edge' };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

const getEnv = () => ({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function upstash(cmds) {
  const { url, token } = getEnv();
  if (!url || !token) throw new Error('Upstash not configured');
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ commands: cmds }),
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  return res.json();
}

function stableKey({ provider, model, messages, temperature = 0.7 }) {
  const data = { provider, model, messages, temperature };
  const text = JSON.stringify(data);
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then((buf) => {
    const hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    return `agentcache:v1:${provider}:${model}:${hex}`;
  });
}

function auth(c) {
  const apiKey = c.headers.get('x-api-key') || c.headers.get('authorization')?.replace('Bearer ', '');
  if (!apiKey || !apiKey.startsWith('ac_')) return null;
  // TODO: validate real keys later
  return apiKey;
}

export default async function handler(req) {
  try {
    const key = auth(req);
    if (!key) return json({ error: 'Invalid API key' }, 401);

    const body = await req.json();
    const { provider, model, messages, temperature, response, ttl = 60 * 60 * 24 * 7 } = body || {};
    if (!provider || !model || !Array.isArray(messages)) return json({ error: 'Invalid payload' }, 400);

    const cacheKey = await stableKey({ provider, model, messages, temperature });

    if (req.method === 'POST' && req.url.endsWith('/set')) {
      if (typeof response !== 'string') return json({ error: 'response (string) is required' }, 400);
      await upstash([["SETEX", cacheKey, ttl, response]]);
      return json({ success: true, key: cacheKey.slice(-16), ttl });
    }

    if (req.method === 'POST' && req.url.endsWith('/get')) {
      const res = await fetch(`${getEnv().url}/get/${encodeURIComponent(cacheKey)}`, {
        headers: { Authorization: `Bearer ${getEnv().token}` },
        cache: 'no-store',
      });
      if (!res.ok) return json({ hit: false }, 404);
      const text = await res.text();
      return json({ hit: !!text, response: text });
    }

    if (req.method === 'POST' && req.url.endsWith('/check')) {
      const r = await upstash([["EXISTS", cacheKey], ["TTL", cacheKey]]);
      const exists = Array.isArray(r) ? r[0] === 1 || r[0]?.result === 1 : r.result === 1;
      const ttlVal = Array.isArray(r) ? (r[1]?.result ?? 0) : 0;
      return json({ cached: exists, ttl: ttlVal });
    }

    return json({ error: 'Not found' }, 404);
  } catch (err) {
    return json({ error: 'Unexpected error', details: err?.message || String(err) }, 500);
  }
}
