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

export default async function handler(req) {
  // Check for admin token in multiple headers
  const xAdminToken = req.headers.get('x-admin-token') || '';
  const auth = req.headers.get('authorization') || '';
  const token = xAdminToken || (auth.startsWith('Bearer ') ? auth.slice(7) : '');

  if (!token || token !== (process.env.ADMIN_TOKEN || '')) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const key = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !key) return json({ error: 'Service not configured' }, 500);

  try {
    // Get current month for usage stats
    const now = new Date();
    const month = now.toISOString().slice(0, 7); // YYYY-MM
    const today = now.toISOString().slice(0, 10); // YYYY-MM-DD

    // Fetch all growth metrics
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        commands: [
          ['SCARD', 'subscribers'],
          ['SCARD', 'subscribers:pending'],
          ['SCARD', 'waitlist'],
          ['SCARD', 'keys:active'],
          ['KEYS', 'usage:*'],
          ['GET', `stats:global:hits:d:${today}`],
          ['GET', `stats:global:misses:d:${today}`],
          ['GET', `stats:global:tokens:d:${today}`],
        ],
      }),
    });

    const arr = await res.json();
    const subscribers = arr?.[0]?.result ?? 0;
    const pending = arr?.[1]?.result ?? 0;
    const waitlist = arr?.[2]?.result ?? 0;
    const activeKeys = arr?.[3]?.result ?? 0;
    const usageKeys = arr?.[4]?.result ?? [];
    const hitsToday = Number(arr?.[5]?.result ?? 0);
    const missesToday = Number(arr?.[6]?.result ?? 0);
    const tokensToday = Number(arr?.[7]?.result ?? 0);

    // Calculate total users
    const totalUsers = subscribers + pending + waitlist;

    // Calculate real cache metrics
    const totalRequests = hitsToday + missesToday;
    const hitRate = totalRequests > 0 ? ((hitsToday / totalRequests) * 100).toFixed(1) : 0;

    // Calculate cost savings (assume $0.01 per 1K tokens avg)
    const costSavedToday = (tokensToday * 0.01 / 1000).toFixed(2);
    const monthlyProjection = (Number(costSavedToday) * 30).toFixed(2);

    // Query all usage hashes for top users
    let topUsers = [];
    if (usageKeys.length > 0) {
      // Filter for usage hashes (format: usage:{hash})
      const hashKeys = usageKeys.filter(k => k.match(/^usage:[a-f0-9]{64}$/) && !k.includes(':m:'));

      // Get hits/misses for each hash
      const userCommands = [];
      for (const usageKey of hashKeys.slice(0, 20)) { // Limit to 20 users max
        userCommands.push(['HGET', usageKey, 'hits']);
        userCommands.push(['HGET', usageKey, 'misses']);
        userCommands.push(['HGET', `key:${usageKey.split(':')[1]}/email`]);
      }

      if (userCommands.length > 0) {
        const userRes = await fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
          body: JSON.stringify({ commands: userCommands }),
        });
        const userArr = await userRes.json();

        // Parse results into user objects
        const users = [];
        for (let i = 0; i < hashKeys.length && i < 20; i++) {
          const hits = Number(userArr[i * 3]?.result ?? 0);
          const misses = Number(userArr[i * 3 + 1]?.result ?? 0);
          const email = userArr[i * 3 + 2]?.result || 'unknown';
          const total = hits + misses;
          if (total > 0) {
            users.push({
              email: email.replace(/"/g, ''), // Remove quotes from Redis string
              requests: total,
              hit_rate: ((hits / total) * 100).toFixed(0)
            });
          }
        }

        // Sort by total requests and take top 5
        topUsers = users.sort((a, b) => b.requests - a.requests).slice(0, 5);
      }
    }

    // Generate growth data for last 7 days (real dates)
    const growthData = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().slice(0, 10);
      growthData.push({
        day: dayNames[date.getDay()],
        date: dateStr,
        users: i === 0 ? totalUsers : 0 // Only show current count for today
      });
    }

    // Build recent activity
    const recentActivity = [];
    if (totalRequests > 0) {
      recentActivity.push({
        timestamp: new Date().toISOString(),
        message: `${totalRequests} API requests today (${hitsToday} hits, ${missesToday} misses)`
      });
    }
    if (totalUsers > 0) {
      recentActivity.push({
        timestamp: new Date().toISOString(),
        message: `${totalUsers} total users registered`
      });
    }
    if (activeKeys > 0) {
      recentActivity.push({
        timestamp: new Date().toISOString(),
        message: `${activeKeys} active API keys`
      });
    }

    const dashboardData = {
      // User metrics
      total_users: totalUsers,
      new_users_today: 0, // Pending DB implementation
      subscribers,
      pending,
      waitlist,

      // API key metrics
      total_keys: activeKeys,
      demo_keys: 0, // All demo keys are hardcoded, not in Redis
      live_keys: activeKeys,

      // Cache metrics (real data!)
      cache_hits_today: hitsToday,
      cache_misses_today: missesToday,
      total_requests_today: totalRequests,
      hit_rate: Number(hitRate),

      // Cost metrics (real calculations!)
      tokens_saved_today: tokensToday,
      cost_saved_today: `$${costSavedToday}`,
      monthly_projection: `$${monthlyProjection}`,

      // Growth chart data (real dates)
      growth_data: growthData,

      // Top users (real data!)
      top_users: topUsers,

      // Recent activity (real metrics!)
      recent_activity: recentActivity,

      timestamp: new Date().toISOString()
    };

    return json(dashboardData);
  } catch (e) {
    return json({ error: 'Unexpected error', details: e?.message || String(e) }, 500);
  }
}
