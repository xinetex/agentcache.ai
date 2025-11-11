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
  try {
    const authn = await auth(req);
    if (!authn.ok) return json({ error: 'Invalid API key' }, 401);

    const body = await req.json();
    const { provider, model, messages, temperature, response, ttl = 60 * 60 * 24 * 7 } = body || {};
    if (!provider || !model || !Array.isArray(messages)) return json({ error: 'Invalid payload' }, 400);

    const cacheKey = await stableKey({ provider, model, messages, temperature });

    // simple monthly quota for live keys
    if (authn.kind === 'live') {
      const month = new Date().toISOString().slice(0,7);
      const usageKey = `usage:${authn.hash}:m:${month}`;
      const quotaRes = await fetch(`${getEnv().url}/hget/usage:${authn.hash}/monthlyQuota`, { headers:{ Authorization:`Bearer ${getEnv().token}` }, cache:'no-store' });
      const quota = (await quotaRes.text()) || '1000';
      const inc = await upstash([["INCR", usageKey],["EXPIRE",usageKey,60*60*24*40]]);
      const count = Array.isArray(inc) ? inc[0]?.result ?? 0 : inc.result ?? 0;
      if (Number(count) > Number(quota)) return json({ error:'Monthly quota exceeded', quota:Number(quota), used:Number(count) }, 429);
    }

    if (req.method === 'POST' && req.url.endsWith('/set')) {
      if (typeof response !== 'string') return json({ error: 'response (string) is required' }, 400);
      await upstash([["SETEX", cacheKey, ttl, response]]);
      if (authn.kind === 'live') await upstash([["HINCRBY", `usage:${authn.hash}`, "misses", 1]]);
      return json({ success: true, key: cacheKey.slice(-16), ttl });
    }

    if (req.method === 'POST' && req.url.endsWith('/get')) {
      const res = await fetch(`${getEnv().url}/get/${encodeURIComponent(cacheKey)}`, {
        headers: { Authorization: `Bearer ${getEnv().token}` },
        cache: 'no-store',
      });
      if (!res.ok) return json({ hit: false }, 404);
      const text = await res.text();
      if (authn.kind === 'live') await upstash([["HINCRBY", `usage:${authn.hash}`, "hits", 1]]);
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
