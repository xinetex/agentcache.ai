/**
 * AgentCache - URL Listener Registration API
 * POST /api/listeners/register
 * 
 * Register URLs to monitor for content changes
 */

export const config = {
  runtime: 'edge',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, GET, DELETE, OPTIONS',
      'access-control-allow-headers': 'Content-Type, X-API-Key',
    },
  });
}

async function authenticate(req) {
  const apiKey = req.headers.get('x-api-key') ||
    req.headers.get('authorization')?.replace('Bearer ', '');

  if (!apiKey || !apiKey.startsWith('ac_')) {
    return { ok: false, error: 'Invalid API key format' };
  }

  if (apiKey.startsWith('ac_demo_')) {
    return { ok: true, kind: 'demo', hash: 'demo' };
  }

  const hash = await hashKey(apiKey);
  const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
  const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

  const checkRes = await fetch(`${UPSTASH_URL}/exists/key:${hash}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
  });
  const checkData = await checkRes.json();

  if (checkData.result !== 1) {
    return { ok: false, error: 'Invalid API key' };
  }

  return { ok: true, kind: 'live', hash };
}

async function hashKey(key) {
  const enc = new TextEncoder();
  const data = enc.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

async function hashContent(content) {
  // Clean content (remove scripts, styles, timestamps)
  let cleaned = content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g, '')
    .replace(/\d{13}/g, '')
    .replace(/\d{10}/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const enc = new TextEncoder();
  const data = enc.encode(cleaned);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return json({}, 204);
  }

  const auth = await authenticate(req);
  if (!auth.ok) {
    return json({ error: auth.error || 'Unauthorized' }, 401);
  }

  const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
  const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

  // GET: List all listeners for this API key
  if (req.method === 'GET') {
    try {
      const pattern = `listener:${auth.hash}:*`;
      const scanRes = await fetch(`${UPSTASH_URL}/scan/0/match/${encodeURIComponent(pattern)}/count/100`, {
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
      });
      const scanData = await scanRes.json();
      const listenerKeys = scanData.result?.[1] || [];

      const listeners = [];
      for (const key of listenerKeys) {
        const getRes = await fetch(`${UPSTASH_URL}/hgetall/${encodeURIComponent(key)}`, {
          headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
        });
        const getData = await getRes.json();

        if (getData.result && getData.result.length > 0) {
          const listener = {};
          for (let i = 0; i < getData.result.length; i += 2) {
            listener[getData.result[i]] = getData.result[i + 1];
          }
          listener.id = key.split(':')[2];
          listeners.push(listener);
        }
      }

      return json({ listeners, count: listeners.length, debug: { pattern, scanData } });
    } catch (err) {
      return json({ error: 'Failed to fetch listeners', details: err.message }, 500);
    }
  }

  // POST: Register new listener
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      const {
        url,
        checkInterval = 900000,      // Default: 15 minutes
        namespace = 'default',
        invalidateOnChange = true,
        webhook
      } = body;

      if (!url) {
        return json({ error: 'URL is required' }, 400);
      }

      // Validate URL
      try {
        new URL(url);
      } catch {
        return json({ error: 'Invalid URL format' }, 400);
      }

      // Check interval limits based on tier
      const minInterval = auth.kind === 'demo' ? 3600000 : 900000; // Demo: 1h, Live: 15min
      if (checkInterval < minInterval) {
        return json({
          error: `Minimum check interval is ${minInterval}ms (${minInterval / 60000} minutes)`,
          tier: auth.kind
        }, 400);
      }

      // Fetch initial content and hash
      let initialHash = '';
      try {
        const contentRes = await fetch(url, {
          headers: {
            'User-Agent': 'AgentCache-Monitor/1.0 (+https://agentcache.ai)'
          }
        });
        const content = await contentRes.text();
        initialHash = await hashContent(content);
      } catch (err) {
        return json({
          error: 'Failed to fetch URL content',
          details: err.message
        }, 400);
      }

      // Generate listener ID
      const listenerId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const listenerKey = `listener:${auth.hash}:${listenerId}`;

      // Store listener
      const hsetBody = [
        'url', url,
        'checkInterval', checkInterval.toString(),
        'lastCheck', Date.now().toString(),
        'lastHash', initialHash,
        'namespace', namespace,
        'invalidateOnChange', invalidateOnChange.toString(),
        'webhook', webhook || '',
        'enabled', 'true',
        'createdAt', Date.now().toString()
      ];

      const upstashRes = await fetch(`${UPSTASH_URL}/hmset/${encodeURIComponent(listenerKey)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${UPSTASH_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(hsetBody)
      });

      if (!upstashRes.ok) {
        const errorText = await upstashRes.text();
        throw new Error(`Upstash error: ${upstashRes.status} ${errorText} Body: ${JSON.stringify(hsetBody)}`);
      }

      return json({
        success: true,
        listenerId,
        url,
        checkInterval,
        namespace,
        initialHash,
        message: 'Listener registered successfully. Note: monitoring runs via Vercel Cron (separate service required).'
      }, 201);

    } catch (err) {
      return json({ error: 'Failed to register listener', details: err.message }, 500);
    }
  }

  // DELETE: Unregister listener
  if (req.method === 'DELETE') {
    try {
      const url = new URL(req.url);
      const listenerId = url.searchParams.get('id');

      if (!listenerId) {
        return json({ error: 'Listener ID is required' }, 400);
      }

      const listenerKey = `listener:${auth.hash}:${listenerId}`;
      const delRes = await fetch(`${UPSTASH_URL}/del/${encodeURIComponent(listenerKey)}`, {
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
      });
      const delData = await delRes.json();

      if (delData.result === 0) {
        return json({ error: 'Listener not found' }, 404);
      }

      return json({ success: true, message: 'Listener unregistered' });

    } catch (err) {
      return json({ error: 'Failed to unregister listener', details: err.message }, 500);
    }
  }

  return json({ error: 'Method not allowed' }, 405);
}
