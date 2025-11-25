export const config = { runtime: 'nodejs' };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*'
    },
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

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

async function auth(req) {
  const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '');
  if (!apiKey || !apiKey.startsWith('ac_')) return { ok:false };
  if (apiKey.startsWith('ac_demo_')) return { ok:true, kind:'demo', hash:'demo' };
  const hash = await sha256Hex(apiKey);
  const res = await fetch(`${getEnv().url}/hget/key:${hash}/email`, { 
    headers: { Authorization:`Bearer ${getEnv().token}` }, 
    cache:'no-store' 
  });
  if (!res.ok) return { ok:false };
  const email = await res.text();
  if (!email) return { ok:false };
  return { ok:true, kind:'live', hash, email };
}

// Helper: Create HMAC signature for webhook verification
async function createWebhookSignature(payload, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper: Send webhook notification
async function sendWebhook(webhookUrl, event, data, secret) {
  try {
    const payload = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      data
    });
    
    const signature = await createWebhookSignature(payload, secret);
    
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AgentCache-Signature': `sha256=${signature}`,
        'X-AgentCache-Event': event,
        'User-Agent': 'AgentCache-Webhooks/1.0'
      },
      body: payload
    });
    
    return { ok: res.ok, status: res.status };
  } catch (err) {
    console.error('Webhook send error:', err);
    return { ok: false, error: err.message };
  }
}

export default async function handler(req) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return json({ ok: true }, 200);
  }

  try {
    const authn = await auth(req);
    if (!authn.ok) return json({ error: 'Invalid API key' }, 401);

    const webhookKey = `webhook:${authn.hash}`;

    // POST /api/webhooks - Register webhook
    if (req.method === 'POST' && !req.url.includes('/test')) {
      const body = await req.json();
      const { url: webhookUrl, events, secret } = body || {};

      // Validate webhook URL
      if (!webhookUrl || !webhookUrl.startsWith('http')) {
        return json({ error: 'Valid webhook URL required' }, 400);
      }

      // Validate events array
      const validEvents = [
        'cache.hit',
        'cache.miss',
        'quota.warning',
        'quota.exceeded',
        'anomaly.detected',
        'context.expired',
        'performance.degraded',
        'reasoning.cached',  // For Kimi K2 style reasoning
        'reasoning.reused'   // When cached reasoning is used
      ];

      const requestedEvents = Array.isArray(events) ? events : validEvents;
      const invalidEvents = requestedEvents.filter(e => !validEvents.includes(e));
      
      if (invalidEvents.length > 0) {
        return json({ 
          error: 'Invalid events', 
          invalid: invalidEvents,
          valid_events: validEvents 
        }, 400);
      }

      // Generate or validate secret
      const webhookSecret = secret || crypto.randomUUID();

      // Store webhook configuration
      await upstash([
        ['HSET', webhookKey, 
          'url', webhookUrl,
          'events', JSON.stringify(requestedEvents),
          'secret', webhookSecret,
          'created_at', new Date().toISOString(),
          'enabled', 'true'
        ]
      ]);

      return json({
        success: true,
        webhook: {
          url: webhookUrl,
          events: requestedEvents,
          secret: webhookSecret,
          enabled: true
        },
        note: 'Webhook registered successfully. Verify signature using HMAC-SHA256 with your secret.'
      });
    }

    // GET /api/webhooks - Get webhook configuration
    if (req.method === 'GET') {
      const res = await upstash([['HGETALL', webhookKey]]);
      const data = res[0]?.result || [];
      
      if (data.length === 0) {
        return json({ 
          registered: false,
          message: 'No webhook configured. POST to /api/webhooks to register.'
        });
      }

      // Convert array to object
      const webhook = {};
      for (let i = 0; i < data.length; i += 2) {
        webhook[data[i]] = data[i + 1];
      }

      return json({
        registered: true,
        webhook: {
          url: webhook.url,
          events: JSON.parse(webhook.events || '[]'),
          enabled: webhook.enabled === 'true',
          created_at: webhook.created_at
        }
      });
    }

    // DELETE /api/webhooks - Unregister webhook
    if (req.method === 'DELETE') {
      await upstash([['DEL', webhookKey]]);
      return json({ success: true, message: 'Webhook unregistered' });
    }

    // POST /api/webhooks/test - Test webhook
    if (req.method === 'POST' && req.url.includes('/test')) {
      // Get webhook config
      const res = await upstash([['HGETALL', webhookKey]]);
      const data = res[0]?.result || [];
      
      if (data.length === 0) {
        return json({ error: 'No webhook configured' }, 404);
      }

      const webhook = {};
      for (let i = 0; i < data.length; i += 2) {
        webhook[data[i]] = data[i + 1];
      }

      // Send test webhook
      const testData = {
        test: true,
        message: 'This is a test webhook from AgentCache.ai',
        timestamp: new Date().toISOString()
      };

      const result = await sendWebhook(
        webhook.url,
        'webhook.test',
        testData,
        webhook.secret
      );

      if (result.ok) {
        return json({
          success: true,
          message: 'Test webhook sent successfully',
          status: result.status
        });
      } else {
        return json({
          success: false,
          error: 'Webhook delivery failed',
          details: result.error || `HTTP ${result.status}`
        }, 500);
      }
    }

    // POST /api/webhooks/trigger - Internal trigger (called by other endpoints)
    if (req.method === 'POST' && req.url.includes('/trigger')) {
      // Verify internal trigger (simple security check)
      if (req.headers.get('x-internal-trigger') !== 'true') {
        return json({ error: 'Unauthorized' }, 403);
      }

      const body = await req.json();
      const { hash, event, data } = body || {};

      if (!hash || !event || !data) {
        return json({ error: 'Missing required fields: hash, event, data' }, 400);
      }

      // Trigger webhook
      const result = await triggerWebhook(hash, event, data);
      return json({ success: result.ok, ...result });
    }

    return json({ error: 'Method not allowed' }, 405);

  } catch (err) {
    return json({ 
      error: 'Unexpected error', 
      details: err?.message || String(err) 
    }, 500);
  }
}

// Export helper for other endpoints to trigger webhooks
export async function triggerWebhook(apiKeyHash, event, data) {
  try {
    const { url: redisUrl, token: redisToken } = getEnv();
    if (!redisUrl || !redisToken) return { ok: false };

    // Fetch webhook config
    const res = await fetch(redisUrl, {
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${redisToken}`, 
        'content-type': 'application/json' 
      },
      body: JSON.stringify({ 
        commands: [['HGETALL', `webhook:${apiKeyHash}`]] 
      }),
    });

    if (!res.ok) return { ok: false };
    
    const result = await res.json();
    const webhookData = result[0]?.result || [];
    
    if (webhookData.length === 0) return { ok: false, reason: 'no_webhook' };

    const webhook = {};
    for (let i = 0; i < webhookData.length; i += 2) {
      webhook[webhookData[i]] = webhookData[i + 1];
    }

    if (webhook.enabled !== 'true') return { ok: false, reason: 'disabled' };

    const events = JSON.parse(webhook.events || '[]');
    if (!events.includes(event)) return { ok: false, reason: 'event_not_subscribed' };

    // Send webhook
    return await sendWebhook(webhook.url, event, data, webhook.secret);
  } catch (err) {
    console.error('Trigger webhook error:', err);
    return { ok: false, error: err.message };
  }
}
