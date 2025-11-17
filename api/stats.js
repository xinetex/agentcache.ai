export const config = { runtime: 'edge' };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'Content-Type, Authorization, X-API-Key'
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

export default async function handler(req) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return json({ ok: true }, 200);
  }

  try {
    const authn = await auth(req);
    if (!authn.ok) return json({ error: 'Invalid API key' }, 401);

    // Parse query parameters
    const url = new URL(req.url);
    const namespace = url.searchParams.get('namespace') || null;
    const period = url.searchParams.get('period') || '24h'; // 24h, 7d, 30d

    // Calculate time window
    const now = new Date();
    let startTime;
    switch(period) {
      case '1h': startTime = new Date(now - 60 * 60 * 1000); break;
      case '24h': startTime = new Date(now - 24 * 60 * 60 * 1000); break;
      case '7d': startTime = new Date(now - 7 * 24 * 60 * 60 * 1000); break;
      case '30d': startTime = new Date(now - 30 * 24 * 60 * 60 * 1000); break;
      default: startTime = new Date(now - 24 * 60 * 60 * 1000);
    }

    // Fetch usage stats
    const usageKey = `usage:${authn.hash}`;
    const month = now.toISOString().slice(0,7);
    const monthlyUsageKey = `usage:${authn.hash}:m:${month}`;
    const quotaKey = `usage:${authn.hash}/monthlyQuota`;
    
    const commands = [
      ['HGETALL', usageKey],
      ['GET', monthlyUsageKey],
      ['GET', quotaKey]
    ];

    const results = await upstash(commands);
    
    // Parse results
    const usageData = results[0]?.result || [];
    const monthlyCount = parseInt(results[1]?.result || '0', 10);
    const quota = parseInt(results[2]?.result || '1000', 10);

    // Convert usage data array to object
    const usage = {};
    for (let i = 0; i < usageData.length; i += 2) {
      usage[usageData[i]] = parseInt(usageData[i + 1] || '0', 10);
    }

    const hits = usage.hits || 0;
    const misses = usage.misses || 0;
    const totalRequests = hits + misses;
    const hitRate = totalRequests > 0 ? hits / totalRequests : 0;

    // Estimate cost savings (average token cost)
    const avgTokensPerRequest = 1000; // Conservative estimate
    const costPerToken = 0.00001; // ~$0.01 per 1K tokens (GPT-4 average)
    const tokensSaved = hits * avgTokensPerRequest;
    const costSaved = tokensSaved * costPerToken;

    // Estimate latency (based on typical patterns)
    const cacheHitLatency = 35; // ms
    const cacheMissLatency = 1800; // ms (typical LLM API call)
    const avgLatency = totalRequests > 0 
      ? ((hits * cacheHitLatency) + (misses * cacheMissLatency)) / totalRequests 
      : 0;

    // Build response
    const stats = {
      period,
      namespace: namespace || 'default',
      apiKey: `${authn.hash.slice(0, 8)}...`,
      timestamp: now.toISOString(),
      
      metrics: {
        total_requests: totalRequests,
        cache_hits: hits,
        cache_misses: misses,
        hit_rate: parseFloat((hitRate * 100).toFixed(2)),
        
        tokens_saved: tokensSaved,
        cost_saved: `$${costSaved.toFixed(2)}`,
        
        avg_latency_ms: Math.round(avgLatency),
        cache_hit_latency_ms: cacheHitLatency,
        cache_miss_latency_ms: cacheMissLatency
      },
      
      quota: {
        monthly_limit: quota,
        monthly_used: monthlyCount,
        monthly_remaining: Math.max(0, quota - monthlyCount),
        usage_percent: parseFloat(((monthlyCount / quota) * 100).toFixed(1))
      },

      performance: {
        requests_per_day: Math.round(totalRequests / Math.max(1, (now - startTime) / (24 * 60 * 60 * 1000))),
        efficiency_score: parseFloat((hitRate * 100).toFixed(1)), // 0-100 score
        cost_reduction_percent: parseFloat((hitRate * 90).toFixed(1)) // up to 90% savings
      }
    };

    // Add namespace info if provided
    if (namespace) {
      stats.namespace_note = `Showing stats for namespace: ${namespace}. Note: namespace-specific metrics require additional tracking (coming soon).`;
    }

    return json(stats);

  } catch (err) {
    return json({ 
      error: 'Unexpected error', 
      details: err?.message || String(err) 
    }, 500);
  }
}
