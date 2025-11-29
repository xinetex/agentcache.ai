/**
 * POST /api/admin/set-tier
 * Manually override tier for a customer (admin only)
 */

export const config = {
  runtime: 'edge',
};

// Helper to hash API key
async function hashApiKey(apiKey) {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

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
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    // Check admin token
    const adminToken = req.headers.get('x-admin-token') || 
                       req.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
      return json({ error: 'Unauthorized - Admin access required' }, 401);
    }

    const body = await req.json();
    const { apiKey, tier, reason } = body;

    // Validate inputs
    if (!apiKey || !tier) {
      return json({ error: 'apiKey and tier are required' }, 400);
    }

    const validTiers = ['free', 'pro', 'enterprise'];
    if (!validTiers.includes(tier)) {
      return json({ 
        error: 'Invalid tier',
        validTiers 
      }, 400);
    }

    const keyHash = await hashApiKey(apiKey);

    // Update tier in Redis immediately
    const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
    const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (UPSTASH_URL && UPSTASH_TOKEN) {
      // Update tier cache
      await fetch(`${UPSTASH_URL}/set/tier:${keyHash}/${tier}`, {
        headers: { 'Authorization': `Bearer ${UPSTASH_TOKEN}` }
      });

      // Update quota based on tier
      const quotas = {
        free: 10000,
        pro: 1000000,
        enterprise: -1
      };
      const quota = quotas[tier];

      await fetch(`${UPSTASH_URL}/set/usage:${keyHash}:quota/${quota}`, {
        headers: { 'Authorization': `Bearer ${UPSTASH_TOKEN}` }
      });

      await fetch(`${UPSTASH_URL}/set/usage:${keyHash}:tier/${tier}`, {
        headers: { 'Authorization': `Bearer ${UPSTASH_TOKEN}` }
      });

      // Log the change to Redis (audit log)
      const auditEntry = JSON.stringify({
        action: 'tier_change',
        keyHash: keyHash.substring(0, 8),
        oldTier: 'unknown',
        newTier: tier,
        reason: reason || 'Manual override by admin',
        timestamp: new Date().toISOString(),
        adminToken: adminToken.substring(0, 8)
      });

      await fetch(`${UPSTASH_URL}/lpush/audit:tier_changes/${auditEntry}`, {
        headers: { 'Authorization': `Bearer ${UPSTASH_TOKEN}` }
      });

      // Trim audit log to last 1000 entries
      await fetch(`${UPSTASH_URL}/ltrim/audit:tier_changes/0/999`, {
        headers: { 'Authorization': `Bearer ${UPSTASH_TOKEN}` }
      });
    }

    // TODO: Also update in Postgres via Neon HTTP API or connection pool

    return json({
      success: true,
      keyHash: keyHash.substring(0, 8),
      tier: tier,
      quota: tier === 'free' ? 10000 : tier === 'pro' ? 1000000 : -1,
      message: `Tier updated to ${tier}. Changes are effective immediately.`,
      note: 'Postgres update pending - tier changed in Redis cache'
    });

  } catch (error) {
    console.error('[Admin] Set tier error:', error);
    return json({ 
      error: 'Failed to set tier',
      message: error.message 
    }, 500);
  }
}
