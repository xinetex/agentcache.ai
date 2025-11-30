export const config = { runtime: 'nodejs' };

import { requireAuth, withAuth } from '../../lib/auth-middleware.js';
import { createClient } from '@vercel/postgres';

/**
 * PUT /api/user/update-profile
 * Update user profile information (full name)
 * 
 * Headers:
 *   Authorization: Bearer {token}
 * 
 * Body:
 *   { full_name: string }
 * 
 * Response:
 *   { success: true, user: { id, email, full_name } }
 */

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'PUT, OPTIONS',
      'access-control-allow-headers': 'Content-Type, Authorization',
    },
  });
}

async function handleRequest(req) {
  if (req.method === 'OPTIONS') {
    return json({ ok: true });
  }

  if (req.method !== 'PUT') {
    return json({ success: false, error: 'Method not allowed' }, 405);
  }

  // Verify authentication
  const user = await requireAuth(req);
  
  // Parse request body
  const body = await req.json();
  const { full_name } = body;
  
  if (!full_name || full_name.trim().length === 0) {
    return json({ success: false, error: 'Full name is required' }, 400);
  }
  
  if (full_name.length > 100) {
    return json({ success: false, error: 'Full name is too long (max 100 characters)' }, 400);
  }

  // Update user in database
  const client = createClient();
  try {
    await client.connect();
    
    const result = await client.query(`
      UPDATE users
      SET full_name = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, email, full_name
    `, [full_name.trim(), user.id]);
    
    if (result.rows.length === 0) {
      return json({ success: false, error: 'User not found' }, 404);
    }
    
    const updatedUser = result.rows[0];
    
    return json({
      success: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        full_name: updatedUser.full_name,
      },
    });
  } finally {
    await client.end();
  }
}

export default withAuth(handleRequest);
