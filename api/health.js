export const config = { runtime: 'edge' };

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

export default async function handler(req) {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  try {
    // Test Redis connectivity
    const { url, token } = getEnv();
    if (!url || !token) {
      return json({ 
        status: 'degraded',
        service: 'AgentCache.ai',
        version: '1.0.0-mvp',
        timestamp,
        error: 'Redis not configured',
        checks: {
          api: 'healthy',
          redis: 'unavailable'
        }
      }, 503);
    }

    // Quick Redis ping
    const redisStart = Date.now();
    const res = await fetch(url, {
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${token}`, 
        'content-type': 'application/json' 
      },
      body: JSON.stringify({ commands: [["PING"]] }),
    });
    const redisLatency = Date.now() - redisStart;

    if (!res.ok) {
      return json({
        status: 'unhealthy',
        service: 'AgentCache.ai',
        version: '1.0.0-mvp',
        timestamp,
        error: `Redis error: ${res.status}`,
        checks: {
          api: 'healthy',
          redis: 'unhealthy'
        },
        latency_ms: Date.now() - startTime
      }, 503);
    }

    const data = await res.json();
    const redisPong = data?.[0]?.result === 'PONG';

    if (!redisPong) {
      return json({
        status: 'degraded',
        service: 'AgentCache.ai',
        version: '1.0.0-mvp',
        timestamp,
        checks: {
          api: 'healthy',
          redis: 'degraded'
        },
        latency_ms: Date.now() - startTime
      }, 503);
    }

    // All checks passed
    return json({
      status: 'healthy',
      service: 'AgentCache.ai',
      version: '1.0.0-mvp',
      timestamp,
      checks: {
        api: 'healthy',
        redis: 'healthy'
      },
      performance: {
        api_latency_ms: Date.now() - startTime,
        redis_latency_ms: redisLatency
      },
      endpoints: {
        cache: '/api/cache',
        stats: '/api/stats',
        health: '/api/health',
        admin: '/api/admin-stats'
      }
    });

  } catch (err) {
    return json({
      status: 'unhealthy',
      service: 'AgentCache.ai',
      version: '1.0.0-mvp',
      timestamp,
      error: err?.message || String(err),
      checks: {
        api: 'healthy',
        redis: 'error'
      },
      latency_ms: Date.now() - startTime
    }, 503);
  }
}
