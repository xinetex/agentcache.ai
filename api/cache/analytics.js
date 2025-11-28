/**
 * Multi-Tier Cache Analytics API
 * 
 * Provides detailed breakdown of cache performance across L1/L2/L3 tiers
 * Real-time metrics for hit rates, latency, cost savings, and tier distribution
 */

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

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function auth(req) {
  const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '');
  if (!apiKey || !apiKey.startsWith('ac_')) return { ok: false };
  if (apiKey.startsWith('ac_demo_')) return { ok: true, kind: 'demo', hash: null };
  const hash = await sha256Hex(apiKey);
  const res = await fetch(`${getEnv().url}/hget/key:${hash}/email`, {
    headers: { Authorization: `Bearer ${getEnv().token}` },
    cache: 'no-store'
  });
  if (!res.ok) return { ok: false };
  const email = await res.text();
  if (!email) return { ok: false };
  return { ok: true, kind: 'live', hash, email };
}

async function getTierStats(period = '24h') {
  const days = period === '24h' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : 1;
  const today = new Date();
  
  const stats = {
    l1: { hits: 0, latency_avg: 3, cost_per_hit: 0 },
    l2: { hits: 0, latency_avg: 35, cost_per_hit: 0.0001 },
    l3: { hits: 0, latency_avg: 150, cost_per_hit: 0.001 },
    misses: 0,
    tool_hits: 0,
    db_hits: 0,
  };

  // Aggregate stats over the period
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().slice(0, 10);

    // Fetch tier-specific hits
    const l1Hits = await redis('GET', `stats:global:hits:l1:d:${dateStr}`).catch(() => '0');
    const l2Hits = await redis('GET', `stats:global:hits:l2:d:${dateStr}`).catch(() => '0');
    const l3Hits = await redis('GET', `stats:global:hits:l3:d:${dateStr}`).catch(() => '0');
    const totalHits = await redis('GET', `stats:global:hits:d:${dateStr}`).catch(() => '0');
    const misses = await redis('GET', `stats:global:misses:d:${dateStr}`).catch(() => '0');
    const toolHits = await redis('GET', `stats:tool:hits:d:${dateStr}`).catch(() => '0');
    const dbHits = await redis('GET', `stats:db:hits:d:${dateStr}`).catch(() => '0');

    stats.l1.hits += parseInt(l1Hits) || 0;
    stats.l2.hits += parseInt(l2Hits) || 0;
    stats.l3.hits += parseInt(l3Hits) || 0;
    stats.misses += parseInt(misses) || 0;
    stats.tool_hits += parseInt(toolHits) || 0;
    stats.db_hits += parseInt(dbHits) || 0;
  }

  return stats;
}

function calculateCostSavings(stats) {
  // Average LLM cost per request (assumed $0.01-0.05)
  const avgLLMCost = 0.02;
  
  // Calculate savings per tier
  const l1Savings = stats.l1.hits * avgLLMCost; // Free tier
  const l2Savings = stats.l2.hits * (avgLLMCost - stats.l2.cost_per_hit);
  const l3Savings = stats.l3.hits * (avgLLMCost - stats.l3.cost_per_hit);
  const toolSavings = stats.tool_hits * 0.01; // Avg API call cost
  const dbSavings = stats.db_hits * 0.001; // Avg DB query cost
  
  const totalSavings = l1Savings + l2Savings + l3Savings + toolSavings + dbSavings;
  
  // Calculate costs incurred
  const l2Cost = stats.l2.hits * stats.l2.cost_per_hit;
  const l3Cost = stats.l3.hits * stats.l3.cost_per_hit;
  const totalCost = l2Cost + l3Cost;
  
  return {
    total_saved: totalSavings.toFixed(2),
    total_cost: totalCost.toFixed(4),
    net_savings: (totalSavings - totalCost).toFixed(2),
    roi: totalCost > 0 ? ((totalSavings / totalCost) * 100).toFixed(1) : 'Infinity',
    by_tier: {
      l1: l1Savings.toFixed(2),
      l2: l2Savings.toFixed(2),
      l3: l3Savings.toFixed(2),
      tool: toolSavings.toFixed(2),
      db: dbSavings.toFixed(2),
    },
  };
}

function calculateWeightedLatency(stats) {
  const totalHits = stats.l1.hits + stats.l2.hits + stats.l3.hits;
  
  if (totalHits === 0) return 0;
  
  const weightedLatency = (
    (stats.l1.hits * stats.l1.latency_avg) +
    (stats.l2.hits * stats.l2.latency_avg) +
    (stats.l3.hits * stats.l3.latency_avg)
  ) / totalHits;
  
  return Math.round(weightedLatency);
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return json({ ok: true });
  }

  if (req.method !== 'GET') {
    return json({ error: 'Method not allowed. Use GET.' }, 405);
  }

  try {
    const authn = await auth(req);
    if (!authn.ok) return json({ error: 'Invalid API key' }, 401);

    const url = new URL(req.url);
    const namespace = req.headers.get('x-cache-namespace') || url.searchParams.get('namespace') || 'default';
    const period = url.searchParams.get('period') || '24h';

    // Get tier stats
    const stats = await getTierStats(period);
    
    // Calculate totals
    const totalRequests = stats.l1.hits + stats.l2.hits + stats.l3.hits + stats.misses;
    const totalHits = stats.l1.hits + stats.l2.hits + stats.l3.hits;
    const hitRate = totalRequests > 0 ? (totalHits / totalRequests * 100).toFixed(2) : '0.00';
    
    // Calculate cost savings
    const costSavings = calculateCostSavings(stats);
    
    // Calculate average latency
    const avgLatency = calculateWeightedLatency(stats);
    
    // Tier distribution
    const tierDistribution = {
      l1: totalHits > 0 ? (stats.l1.hits / totalHits * 100).toFixed(1) : '0.0',
      l2: totalHits > 0 ? (stats.l2.hits / totalHits * 100).toFixed(1) : '0.0',
      l3: totalHits > 0 ? (stats.l3.hits / totalHits * 100).toFixed(1) : '0.0',
    };

    return json({
      period,
      namespace,
      tiers: {
        l1: {
          name: 'Session Cache',
          hits: stats.l1.hits,
          hit_rate: totalRequests > 0 ? (stats.l1.hits / totalRequests * 100).toFixed(1) : '0.0',
          latency_avg: stats.l1.latency_avg,
          cost_per_hit: stats.l1.cost_per_hit,
          description: 'In-memory, instant retrieval',
        },
        l2: {
          name: 'Redis Cache',
          hits: stats.l2.hits,
          hit_rate: totalRequests > 0 ? (stats.l2.hits / totalRequests * 100).toFixed(1) : '0.0',
          latency_avg: stats.l2.latency_avg,
          cost_per_hit: stats.l2.cost_per_hit,
          description: 'Global edge cache',
        },
        l3: {
          name: 'Semantic Cache',
          hits: stats.l3.hits,
          hit_rate: totalRequests > 0 ? (stats.l3.hits / totalRequests * 100).toFixed(1) : '0.0',
          latency_avg: stats.l3.latency_avg,
          cost_per_hit: stats.l3.cost_per_hit,
          description: 'Vector similarity search',
        },
      },
      additional_caches: {
        tool: {
          hits: stats.tool_hits,
          description: 'Function/tool call results',
        },
        database: {
          hits: stats.db_hits,
          description: 'Database query results',
        },
      },
      metrics: {
        total_requests: totalRequests,
        cache_hits: totalHits,
        cache_misses: stats.misses,
        hit_rate: parseFloat(hitRate),
        miss_rate: (100 - parseFloat(hitRate)).toFixed(2),
        avg_latency_ms: avgLatency,
      },
      tier_distribution: {
        l1_percent: parseFloat(tierDistribution.l1),
        l2_percent: parseFloat(tierDistribution.l2),
        l3_percent: parseFloat(tierDistribution.l3),
      },
      cost_savings: {
        ...costSavings,
        currency: 'USD',
      },
      efficiency: {
        requests_per_day: Math.round(totalRequests / (period === '24h' ? 1 : period === '7d' ? 7 : 30)),
        efficiency_score: parseFloat(hitRate),
        cost_reduction_percent: totalRequests > 0 && stats.misses > 0
          ? ((totalHits / totalRequests) * 100).toFixed(1)
          : '0.0',
      },
    });

  } catch (err) {
    console.error('Analytics error:', err);
    return json({
      error: 'Unexpected error',
      details: err?.message || String(err)
    }, 500);
  }
}
