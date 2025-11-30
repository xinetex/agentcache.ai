export const config = { runtime: 'nodejs' };

import { requireAuth, getUserOrganization, withAuth } from '../../lib/auth-middleware.js';

/**
 * GET /api/auth/me
 * Get current authenticated user profile with organization details
 * 
 * Headers:
 *   Authorization: Bearer {token}
 * 
 * Response:
 * {
 *   success: true,
 *   user: {
 *     id, email, full_name, role,
 *     organization: { id, name, slug, namespaces, api_keys_count }
 *   }
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

  // Get full organization details if user has one
  let organization = null;
  if (user.organizationId) {
    organization = await getUserOrganization(user.id);
  }

  return json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      organization: organization ? {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        sector: organization.sector,
        plan_tier: organization.plan_tier,
        status: organization.status,
        namespaces: organization.namespaces || [],
        api_keys_count: parseInt(organization.api_keys_count) || 0,
        max_namespaces: organization.max_namespaces,
        max_api_keys: organization.max_api_keys,
        created_at: organization.created_at,
      } : null,
    },
  });
}

export default withAuth(handleRequest);
