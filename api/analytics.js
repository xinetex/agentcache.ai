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

/**
 * Enterprise Analytics API
 * 
 * Provides namespace-level metrics, cost allocation, and audit trail queries
 * for enterprise customers integrating with data lakehouse platforms.
 * 
 * Query Parameters:
 * - namespace: Filter by namespace (e.g., "databricks/team-a")
 * - start_date: ISO date string (default: 30 days ago)
 * - end_date: ISO date string (default: now)
 * - group_by: "hour" | "day" | "week" (default: "day")
 */
export default async function handler(req) {
  // Auth
  const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '');
  if (!apiKey || !apiKey.startsWith('ac_')) {
    return json({ error: 'Missing or invalid API key' }, 401);
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return json({ error: 'Service not configured' }, 500);

  // Parse query params
  const reqUrl = new URL(req.url);
  const namespace = reqUrl.searchParams.get('namespace') || 'default';
  const groupBy = reqUrl.searchParams.get('group_by') || 'day';
  
  // Date range (default: last 30 days)
  const endDate = new Date(reqUrl.searchParams.get('end_date') || Date.now());
  const startDate = new Date(reqUrl.searchParams.get('start_date') || (endDate.getTime() - 30 * 24 * 60 * 60 * 1000));

  try {
    // Determine API key type
    const isDemo = apiKey.startsWith('ac_demo_');
    let keyHash = null;
    
    if (!isDemo) {
      // Hash the live key to get Redis key
      const encoder = new TextEncoder();
      const data = encoder.encode(apiKey);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Build time series data based on group_by
    const timeSeries = [];
    const timePoints = generateTimePoints(startDate, endDate, groupBy);
    
    // Fetch metrics for each time point
    const commands = [];
    for (const point of timePoints) {
      const dateKey = formatDateKey(point.date, groupBy);
      const nsPrefix = namespace === 'default' ? '' : `ns:${namespace}:`;
      
      commands.push(['GET', `${nsPrefix}stats:hits:${groupBy.charAt(0)}:${dateKey}`]);
      commands.push(['GET', `${nsPrefix}stats:misses:${groupBy.charAt(0)}:${dateKey}`]);
      commands.push(['GET', `${nsPrefix}stats:tokens:${groupBy.charAt(0)}:${dateKey}`]);
      commands.push(['GET', `${nsPrefix}stats:cost:${groupBy.charAt(0)}:${dateKey}`]);
    }

    // Execute all commands in batch
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ commands }),
    });

    const results = await res.json();
    
    // Parse results into time series
    for (let i = 0; i < timePoints.length; i++) {
      const baseIdx = i * 4;
      const hits = Number(results[baseIdx]?.result || 0);
      const misses = Number(results[baseIdx + 1]?.result || 0);
      const tokens = Number(results[baseIdx + 2]?.result || 0);
      const cost = Number(results[baseIdx + 3]?.result || 0);
      
      const total = hits + misses;
      timeSeries.push({
        timestamp: timePoints[i].date.toISOString(),
        label: timePoints[i].label,
        hits,
        misses,
        total_requests: total,
        hit_rate: total > 0 ? Math.round((hits / total) * 100) : 0,
        tokens_saved: tokens,
        cost_saved: cost,
      });
    }

    // Calculate aggregates
    const totals = timeSeries.reduce((acc, point) => ({
      hits: acc.hits + point.hits,
      misses: acc.misses + point.misses,
      tokens: acc.tokens + point.tokens_saved,
      cost: acc.cost + point.cost_saved,
    }), { hits: 0, misses: 0, tokens: 0, cost: 0 });

    const totalRequests = totals.hits + totals.misses;
    const overallHitRate = totalRequests > 0 ? Math.round((totals.hits / totalRequests) * 100) : 0;

    // Get namespace info (if available)
    let namespaceInfo = null;
    if (namespace !== 'default') {
      const nsInfoRes = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          commands: [
            ['HGETALL', `namespace:${namespace}`],
          ],
        }),
      });
      const nsData = await nsInfoRes.json();
      const nsFields = nsData?.[0]?.result || [];
      
      // Parse Redis hash into object
      if (nsFields.length > 0) {
        namespaceInfo = {};
        for (let i = 0; i < nsFields.length; i += 2) {
          namespaceInfo[nsFields[i]] = nsFields[i + 1];
        }
      }
    }

    // Return enterprise analytics
    return json({
      namespace,
      date_range: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        group_by: groupBy,
      },
      summary: {
        total_requests: totalRequests,
        cache_hits: totals.hits,
        cache_misses: totals.misses,
        hit_rate: overallHitRate,
        tokens_saved: totals.tokens,
        cost_saved: `$${totals.cost.toFixed(2)}`,
        avg_latency_ms: 45, // TODO: Track actual latencies
      },
      namespace_info: namespaceInfo,
      time_series: timeSeries,
      generated_at: new Date().toISOString(),
    });

  } catch (err) {
    return json({ error: 'Failed to fetch analytics', details: err.message }, 500);
  }
}

// Helper: Generate time points for the series
function generateTimePoints(start, end, groupBy) {
  const points = [];
  const current = new Date(start);
  
  while (current <= end) {
    points.push({
      date: new Date(current),
      label: formatLabel(current, groupBy),
    });
    
    // Increment based on grouping
    switch (groupBy) {
      case 'hour':
        current.setHours(current.getHours() + 1);
        break;
      case 'day':
        current.setDate(current.getDate() + 1);
        break;
      case 'week':
        current.setDate(current.getDate() + 7);
        break;
    }
  }
  
  return points;
}

// Helper: Format date key for Redis
function formatDateKey(date, groupBy) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  
  switch (groupBy) {
    case 'hour':
      return `${year}-${month}-${day}-${hour}`;
    case 'day':
      return `${year}-${month}-${day}`;
    case 'week':
      // Use ISO week format: YYYY-Www
      const weekNum = getWeekNumber(date);
      return `${year}-W${String(weekNum).padStart(2, '0')}`;
    default:
      return `${year}-${month}-${day}`;
  }
}

// Helper: Format human-readable label
function formatLabel(date, groupBy) {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  switch (groupBy) {
    case 'hour':
      return `${monthNames[date.getMonth()]} ${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:00`;
    case 'day':
      return `${dayNames[date.getDay()]} ${monthNames[date.getMonth()]} ${date.getDate()}`;
    case 'week':
      return `Week of ${monthNames[date.getMonth()]} ${date.getDate()}`;
    default:
      return date.toISOString().split('T')[0];
  }
}

// Helper: Get ISO week number
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}
