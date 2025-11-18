export const config = { runtime: 'edge' };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
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

export default async function handler(req, { params }) {
  if (req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }
  
  try {
    const traceId = params?.traceId;
    
    if (!traceId) {
      return json({ error: 'traceId is required' }, 400);
    }
    
    // Fetch trace data from Redis
    const traceData = await redis('GET', `trace:${traceId}`);
    
    if (!traceData) {
      return json({ error: 'Trace not found or expired' }, 404);
    }
    
    const trace = JSON.parse(traceData);
    
    // Calculate aggregated metrics
    const totalCost = trace.spans.reduce((sum, span) => sum + (span.cost || 0), 0);
    const totalSavings = trace.spans.reduce((sum, span) => sum + (span.estimatedSavings || 0), 0);
    const avgLatency = trace.spans.length > 0 
      ? trace.spans.reduce((sum, span) => sum + span.latency, 0) / trace.spans.length 
      : 0;
    
    // Group spans by provider
    const byProvider = {};
    trace.spans.forEach(span => {
      if (!byProvider[span.provider]) {
        byProvider[span.provider] = {
          provider: span.provider,
          requests: 0,
          cached: 0,
          errors: 0,
          totalLatency: 0,
          models: new Set()
        };
      }
      byProvider[span.provider].requests++;
      byProvider[span.provider].models.add(span.model);
      byProvider[span.provider].totalLatency += span.latency;
      if (span.cached) byProvider[span.provider].cached++;
      if (span.status === 'error') byProvider[span.provider].errors++;
    });
    
    // Convert Set to Array for JSON serialization
    Object.values(byProvider).forEach(p => {
      p.models = Array.from(p.models);
      p.avgLatency = p.totalLatency / p.requests;
    });
    
    return json({
      traceId: trace.traceId,
      strategy: trace.strategy,
      timestamp: trace.timestamp,
      date: new Date(trace.timestamp).toISOString(),
      summary: {
        totalModels: trace.models,
        totalSpans: trace.spans.length,
        totalLatency: trace.totalLatency,
        avgLatency: Math.round(avgLatency),
        cacheHits: trace.cacheHits,
        cacheMisses: trace.cacheMisses,
        cacheHitRate: trace.cacheHits / (trace.cacheHits + trace.cacheMisses) * 100,
        errors: trace.errors,
        totalCost: totalCost.toFixed(6),
        estimatedSavings: totalSavings.toFixed(6),
        savingsPercent: totalSavings > 0 ? ((totalSavings / (totalSavings + totalCost)) * 100).toFixed(2) : 0
      },
      byProvider: Object.values(byProvider),
      spans: trace.spans.map(span => ({
        ...span,
        duration: span.latency,
        timestamp: new Date(span.startTime).toISOString()
      })),
      results: trace.results
    });
    
  } catch (err) {
    console.error('Trace retrieval error:', err);
    return json({ 
      error: 'Failed to retrieve trace', 
      details: err?.message || String(err) 
    }, 500);
  }
}
