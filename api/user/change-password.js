export const config = { runtime: 'nodejs' };

import { requireAuth, withAuth } from '../../lib/auth-middleware.js';
import { createClient } from '@vercel/postgres';
import bcrypt from 'bcryptjs';

/**
 * PUT /api/user/change-password
 * Change user password
 * 
 * Headers:
 *   Authorization: Bearer {token}
 * 
 * Body:
 *   { current_password: string, new_password: string }
 * 
 * Response:
 *   { success: true }
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
  const { current_password, new_password } = body;
  
  // Validation
  if (!current_password || !new_password) {
    return json({ success: false, error: 'Current and new password are required' }, 400);
  }
  
  if (new_password.length < 8) {
    return json({ success: false, error: 'New password must be at least 8 characters long' }, 400);
  }
  
  if (new_password.length > 128) {
    return json({ success: false, error: 'New password is too long (max 128 characters)' }, 400);
  }

  // Get user from database with password hash
  const client = createClient();
  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT id, email, password_hash
      FROM users
      WHERE id = $1
    `, [user.id]);
    
    if (result.rows.length === 0) {
      return json({ success: false, error: 'User not found' }, 404);
    }
    
    const dbUser = result.rows[0];
    
    // Verify current password
    const isValidPassword = await bcrypt.compare(current_password, dbUser.password_hash);
    
    if (!isValidPassword) {
      return json({ success: false, error: 'Current password is incorrect' }, 401);
    }
    
    // Hash new password
    const newPasswordHash = await bcrypt.hash(new_password, 10);
    
    // Update password in database
    await client.query(`
      UPDATE users
      SET password_hash = $1, updated_at = NOW()
      WHERE id = $2
    `, [newPasswordHash, user.id]);
    
    return json({
      success: true,
      message: 'Password changed successfully',
    });
  } finally {
    await client.end();
  }
}

export default withAuth(handleRequest);
