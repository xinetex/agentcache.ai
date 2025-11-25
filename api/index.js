export const config = { runtime: 'nodejs' };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'Content-Type, Authorization, X-API-Key, X-Cache-Namespace',
    },
  });
}

export default function handler(req) {
  if (req.method === 'OPTIONS') {
    return json({ ok: true });
  }

  return json({
    service: 'AgentCache.ai',
    tagline: 'Edge caching for AI responses - Save up to 90% on LLM costs',
    version: '1.0.0-mvp',
    status: 'beta',
    docs: 'https://agentcache.ai/docs',
    endpoints: {
      '/api/health': 'Health check',
      '/api/cache/check': 'Check if response is cached',
      '/api/cache/get': 'Get cached response',
      '/api/cache/set': 'Store response in cache',
      '/api/stats': 'Usage statistics',
      '/api/moonshot': 'Moonshot AI (Kimi K2) proxy with reasoning cache',
      '/api/webhooks': 'Manage quota/cache webhooks',
      '/api/admin-stats': 'Admin growth dashboard (protected)',
    },
  });
}
