import crypto from 'crypto';

export const config = { runtime: 'nodejs' };

function json(res, data, status = 200) {
  return res.status(status).json(data);
}

function getHeader(req, name) {
  // Vercel/Node may normalize to lowercase
  const v = req.headers?.[name.toLowerCase()] ?? req.headers?.[name];
  return Array.isArray(v) ? v[0] : v;
}

function getApiKey(req) {
  const apiKey = getHeader(req, 'x-api-key') || getHeader(req, 'X-API-Key');
  if (apiKey) return apiKey;

  const auth = getHeader(req, 'authorization') || getHeader(req, 'Authorization');
  if (auth && auth.startsWith('Bearer ')) return auth.slice('Bearer '.length);
  return null;
}

function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

async function upstashGet(key) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Upstash not configured');

  const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Upstash GET failed: ${res.status}`);
  }

  const data = await res.json();
  return data.result;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return json(res, { error: 'Method not allowed' }, 405);
  }

  try {
    const apiKey = getApiKey(req);
    if (!apiKey || !apiKey.startsWith('ac_')) {
      return json(res, { error: 'Invalid or missing API key' }, 401);
    }

    const keyHash = hashApiKey(apiKey);
    const raw = await upstashGet(`credits:${keyHash}`);
    const credits = Math.max(0, parseInt(raw || '0', 10) || 0);

    return json(res, {
      credits,
      usd: (credits / 100).toFixed(2),
      key_hash: `${keyHash.slice(0, 8)}...`,
    });
  } catch (error) {
    return json(res, { error: 'Failed to fetch credits balance', details: error.message }, 500);
  }
}
