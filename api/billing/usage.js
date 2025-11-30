export const config = { runtime: 'nodejs' };

import { requireAuth, withAuth } from '../../lib/auth-middleware.js';
import { createClient } from '@vercel/postgres';

/**
 * GET /api/billing/usage
 * Get current user's billing information and usage stats
 * 
 * Headers:
 *   Authorization: Bearer {token}
 * 
 * Response:
 * {
 *   subscription: { plan: 'starter'|'professional'|'enterprise', status: 'active' },
 *   pipelines: [ {...} ],
 *   usage: { requests_this_month, quota },
 *   billing_cycle: { start, end, days_remaining }
 * }
 */

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'Content-Type, Authorization',
    },
  });
}

async function handleRequest(req) {
  if (req.method === 'OPTIONS') {
    return json({ ok: true });
  }

  if (req.method !== 'GET') {
    return json({ success: false, error: 'Method not allowed' }, 405);
  }

  // Verify authentication
  const user = await requireAuth(req);
  
  if (!user.organizationId) {
    return json({
      success: false,
      error: 'No organization found. Please complete onboarding.',
    }, 400);
  }

  const client = createClient();
  try {
    await client.connect();
    
    // Get organization with plan info
    const orgResult = await client.query(`
      SELECT id, name, plan_tier, status, created_at
      FROM organizations
      WHERE id = $1
    `, [user.organizationId]);
    
    if (orgResult.rows.length === 0) {
      return json({ success: false, error: 'Organization not found' }, 404);
    }
    
    const org = orgResult.rows[0];
    
    // Get user's pipelines
    const pipelinesResult = await client.query(`
      SELECT id, name, sector, complexity, monthly_cost, created_at, is_active
      FROM pipelines
      WHERE organization_id = $1
      ORDER BY created_at DESC
    `, [user.organizationId]);
    
    // Get current month usage (if usage tracking table exists)
    const currentMonth = new Date();
    const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    
    let usage = {
      requests_this_month: 0,
      quota: getPlanQuota(org.plan_tier),
    };
    
    // Try to get actual usage if table exists
    try {
      const usageResult = await client.query(`
        SELECT COUNT(*) as request_count
        FROM cache_requests
        WHERE organization_id = $1
        AND created_at >= $2
      `, [user.organizationId, firstDayOfMonth]);
      
      if (usageResult.rows.length > 0) {
        usage.requests_this_month = parseInt(usageResult.rows[0].request_count) || 0;
      }
    } catch (err) {
      // Table might not exist yet, use default values
      console.log('Usage tracking not available:', err.message);
    }
    
    // Calculate billing cycle
    const today = new Date();
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const daysRemaining = Math.ceil((lastDayOfMonth - today) / (1000 * 60 * 60 * 24));
    
    return json({
      success: true,
      subscription: {
        plan: org.plan_tier || 'starter',
        status: org.status || 'active',
      },
      pipelines: pipelinesResult.rows.map(p => ({
        id: p.id,
        name: p.name,
        sector: p.sector,
        complexity: p.complexity,
        monthly_cost: parseFloat(p.monthly_cost) || 0,
        created_at: p.created_at,
        is_active: p.is_active,
      })),
      usage,
      billing_cycle: {
        start: firstDayOfMonth.toISOString(),
        end: lastDayOfMonth.toISOString(),
        days_remaining: daysRemaining,
      },
      organization: {
        id: org.id,
        name: org.name,
        created_at: org.created_at,
      },
    });
  } finally {
    await client.end();
  }
}

function getPlanQuota(plan) {
  const quotas = {
    starter: 10000,
    professional: 100000,
    enterprise: 1000000,
  };
  return quotas[plan] || quotas.starter;
}

export default withAuth(handleRequest);
