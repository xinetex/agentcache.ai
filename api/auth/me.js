export const config = { runtime: 'nodejs' };

import { getAuthErrorStatus, getUserOrganization, requireAuth } from '../../lib/auth-middleware.js';

/**
 * GET /api/auth/me
 * Get current authenticated user profile with organization details.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const user = await requireAuth(req);

    let organization = null;
    if (user.organizationId) {
      organization = await getUserOrganization(user.id);
    }

    return res.status(200).json({
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
          api_keys_count: parseInt(organization.api_keys_count, 10) || 0,
          max_namespaces: organization.max_namespaces,
          max_api_keys: organization.max_api_keys,
          created_at: organization.created_at,
        } : null,
      },
    });
  } catch (error) {
    const authStatus = getAuthErrorStatus(error);
    if (authStatus) {
      return res.status(authStatus).json({ success: false, error: error.message });
    }

    console.error('Auth profile error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}
