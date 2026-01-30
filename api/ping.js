export const config = { runtime: 'edge' };

export default async function handler(req) {
  const url = new URL(req.url);

  if (url.searchParams.get('grok')) {
    try {
      const key = process.env.AI_GATEWAY_API_KEY;
      if (!key) return new Response(JSON.stringify({ error: 'No key' }), { status: 500 });

      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model: process.env.AI_GATEWAY_MODEL || 'grok-beta',
          messages: [{ role: 'user', content: 'Ping.' }],
          stream: false
        })
      });
      return new Response(JSON.stringify({ grok: await response.json() }), { status: 200 });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  if (url.searchParams.get('perplexity')) {
    try {
      const key = process.env.PERPLEXITY_API_KEY;
      if (!key) return new Response(JSON.stringify({ error: 'PERPLEXITY_API_KEY is missing' }), { status: 500 });

      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model: process.env.PERPLEXITY_MODEL || 'sonar-pro',
          messages: [{ role: 'user', content: 'Ping.' }],
          stream: false
        })
      });
      return new Response(JSON.stringify({ perplexity: await response.json() }), { status: 200 });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    service: 'agentcache',
    ts: new Date().toISOString(),
    debug_url: req.url,
    debug_params: Object.fromEntries(url.searchParams)
  }), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}