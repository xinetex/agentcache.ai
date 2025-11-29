/**
 * GET /api/admin/customers
 * List all API keys with tier information (admin only)
 */

export const config = {
  runtime: 'edge',
};

// Helper for JSON responses
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export default async function handler(req) {
  if (req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    // Check admin token
    const adminToken = req.headers.get('x-admin-token') || 
                       req.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
      return json({ error: 'Unauthorized - Admin access required' }, 401);
    }

    // Query Postgres via Neon for all API keys
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return json({ error: 'Database not configured' }, 500);
    }

    // Since we can't use Neon SDK in edge runtime, use Redis to get cached data
    // In a real implementation, you'd use a proper connection pool or Neon's HTTP API
    const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
    const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!UPSTASH_URL || !UPSTASH_TOKEN) {
      return json({ error: 'Redis not configured' }, 500);
    }

    // For now, return mock data (in production, query Postgres via HTTP API)
    const mockCustomers = [
      {
        key_prefix: 'ac_commun...',
        user_id: 'verdoni@gmail.com',
        tier: 'free',
        created_at: '2025-01-29T00:00:00Z',
        request_count: 234,
        subscription_status: 'active',
        last_used_at: '2025-01-29T12:00:00Z'
      }
    ];

    return json({
      success: true,
      customers: mockCustomers,
      total: mockCustomers.length,
      note: 'Full Postgres integration pending - showing mock data'
    });

  } catch (error) {
    console.error('[Admin] Customers error:', error);
    return json({ 
      error: 'Failed to fetch customers',
      message: error.message 
    }, 500);
  }
}
