import { verifyToken, extractTokenFromHeader } from './jwt.js';
import { createClient } from '@vercel/postgres';

/**
 * Authentication & Authorization Middleware
 * Protects routes and enforces organization access control
 */

/**
 * Require authentication - verify JWT and attach user to request
 * @param {Request} req - HTTP request object
 * @returns {Promise<Object>} User object with organization data
 * @throws {Error} 401 if not authenticated
 */
export async function requireAuth(req) {
  const authHeader = req.headers.get('authorization');
  const token = extractTokenFromHeader(authHeader);

  if (!token) {
    throw new Error('No authentication token provided');
  }

  const decoded = verifyToken(token);

  if (!decoded) {
    throw new Error('Invalid or expired token');
  }

  // Fetch fresh user data from database to get full_name and latest info
  const client = createClient();
  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT id, email, full_name, organization_id, role
      FROM users
      WHERE id = $1 AND is_active = true
    `, [decoded.userId || decoded.id]);
    
    if (result.rows.length === 0) {
      throw new Error('User not found or inactive');
    }
    
    const user = result.rows[0];
    
    return {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      organizationId: user.organization_id,
      role: user.role || 'member',
    };
  } finally {
    await client.end();
  }
}

/**
 * Require organization access - verify user belongs to org
 * @param {Request} req - HTTP request object
 * @param {string} orgId - Organization ID to check access for
 * @returns {Promise<Object>} User object
 * @throws {Error} 403 if user doesn't have access to org
 */
export async function requireOrgAccess(req, orgId) {
  const user = await requireAuth(req);

  // If no org specified, allow if user has any org
  if (!orgId) {
    return user;
  }

  // Check if user belongs to the requested organization
  if (user.organizationId !== orgId) {
    throw new Error(`Access denied to organization ${orgId}`);
  }

  return user;
}

/**
 * Require minimum role level
 * @param {Request} req - HTTP request object
 * @param {string} minRole - Minimum required role (viewer, member, admin, owner)
 * @returns {Promise<Object>} User object
 * @throws {Error} 403 if user doesn't have required role
 */
export async function requireRole(req, minRole) {
  const user = await requireAuth(req);

  const roleHierarchy = {
    viewer: 1,
    member: 2,
    admin: 3,
    owner: 4,
  };

  const userLevel = roleHierarchy[user.role] || 0;
  const requiredLevel = roleHierarchy[minRole] || 0;

  if (userLevel < requiredLevel) {
    throw new Error(`Insufficient permissions. Required: ${minRole}, Current: ${user.role}`);
  }

  return user;
}

/**
 * Get user's organization with full details
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Organization object with namespaces
 */
export async function getUserOrganization(userId) {
  const client = createClient();

  try {
    await client.connect();

    const result = await client.query(`
      SELECT 
        o.*,
        (
          SELECT json_agg(json_build_object(
            'id', n.id,
            'name', n.name,
            'display_name', n.display_name,
            'is_active', n.is_active
          ))
          FROM namespaces n
          WHERE n.organization_id = o.id AND n.is_active = true
        ) as namespaces,
        (
          SELECT COUNT(*)
          FROM api_keys ak
          WHERE ak.organization_id = o.id AND ak.is_active = true
        ) as api_keys_count
      FROM organizations o
      JOIN users u ON u.organization_id = o.id
      WHERE u.id = $1 AND o.status = 'active'
    `, [userId]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } finally {
    await client.end();
  }
}

/**
 * Helper function to create standard error responses
 * @param {string} message - Error message
 * @param {number} status - HTTP status code
 * @returns {Response} JSON error response
 */
export function createAuthError(message, status = 401) {
  return new Response(
    JSON.stringify({
      success: false,
      error: message,
      code: status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN',
    }),
    {
      status,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store',
      },
    }
  );
}

/**
 * Wrapper to handle auth errors in route handlers
 * @param {Function} handler - Route handler function
 * @returns {Function} Wrapped handler with error handling
 */
export function withAuth(handler) {
  return async (req) => {
    try {
      return await handler(req);
    } catch (error) {
      if (error.message.includes('No authentication token') || 
          error.message.includes('Invalid or expired token')) {
        return createAuthError(error.message, 401);
      }
      if (error.message.includes('Access denied') || 
          error.message.includes('Insufficient permissions')) {
        return createAuthError(error.message, 403);
      }
      // Other errors
      console.error('Auth middleware error:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Internal server error',
        }),
        {
          status: 500,
          headers: { 'content-type': 'application/json' },
        }
      );
    }
  };
}

export default {
  requireAuth,
  requireOrgAccess,
  requireRole,
  getUserOrganization,
  createAuthError,
  withAuth,
};
