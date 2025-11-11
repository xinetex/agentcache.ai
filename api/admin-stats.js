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
        ],
      }),
    });
    
    const arr = await res.json();
    const subscribers = arr?.[0]?.result ?? 0;
    const pending = arr?.[1]?.result ?? 0;
    const waitlist = arr?.[2]?.result ?? 0;
    const activeKeys = arr?.[3]?.result ?? 0;
    const usageKeys = arr?.[4]?.result ?? [];

    // Calculate total users (subscribers + pending + waitlist)
    const totalUsers = subscribers + pending + waitlist;
    
    // Mock data for now - will be replaced with real Redis queries
    const dashboardData = {
      // User metrics
      total_users: totalUsers,
      new_users_today: 0, // TODO: Track signups by day
      subscribers,
      pending,
      waitlist,
      
      // API key metrics
      total_keys: activeKeys,
      demo_keys: 0, // TODO: Count demo keys
      live_keys: activeKeys,
      
      // Cache metrics (mock for now)
      cache_hits_today: 0,
      cache_misses_today: 0,
      hit_rate: 0,
      
      // Cost metrics (mock for now)
      cost_saved_today: 0,
      monthly_projection: 0,
      
      // Growth chart data (last 7 days)
      growth_data: [
        { day: 'Mon', date: '2025-01-06', users: 0 },
        { day: 'Tue', date: '2025-01-07', users: 0 },
        { day: 'Wed', date: '2025-01-08', users: 0 },
        { day: 'Thu', date: '2025-01-09', users: 0 },
        { day: 'Fri', date: '2025-01-10', users: 0 },
        { day: 'Sat', date: '2025-01-11', users: totalUsers },
        { day: 'Sun', date: '2025-01-12', users: totalUsers },
      ],
      
      // Top users (mock for now)
      top_users: [],
      
      // Recent activity (mock for now)
      recent_activity: totalUsers > 0 ? [
        { 
          timestamp: new Date().toISOString(), 
          message: `${totalUsers} total users registered` 
        }
      ] : [],
      
      timestamp: new Date().toISOString()
    };

    return json(dashboardData);
  } catch (e) {
    return json({ error: 'Unexpected error', details: e?.message || String(e) }, 500);
  }
}
