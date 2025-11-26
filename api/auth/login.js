export const config = { runtime: 'nodejs' };

import { createClient } from '@vercel/postgres';
import bcrypt from 'bcrypt';
import { generateToken } from '../../lib/jwt.js';

/**
 * POST /api/auth/login
 * Authenticate customer and return JWT token
 * 
 * Request body:
 * {
 *   email: string,
 *   password: string
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   token: string,
 *   user: { id, email, organization_id, role }
 * }
 */

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'Content-Type',
    },
  });
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return json({ ok: true });
  }

  if (req.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, 405);
  }

  const client = createClient();

  try {
    const body = await req.json();
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return json({
        success: false,
        error: 'Email and password are required'
      }, 400);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return json({
        success: false,
        error: 'Invalid email format'
      }, 400);
    }

    await client.connect();

    // Find user by email
    const userResult = await client.query(`
      SELECT 
        u.*,
        o.name as organization_name,
        o.slug as organization_slug,
        o.status as organization_status
      FROM users u
      LEFT JOIN organizations o ON u.organization_id = o.id
      WHERE u.email = $1 AND u.is_active = true
    `, [email.toLowerCase()]);

    if (userResult.rows.length === 0) {
      // Don't reveal whether user exists
      return json({
        success: false,
        error: 'Invalid email or password'
      }, 401);
    }

    const user = userResult.rows[0];

    // Check if organization is active (if user has one)
    if (user.organization_id && user.organization_status !== 'active') {
      return json({
        success: false,
        error: 'Your organization account is not active. Please contact support.'
      }, 403);
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return json({
        success: false,
        error: 'Invalid email or password'
      }, 401);
    }

    // Update last login timestamp
    await client.query(`
      UPDATE users 
      SET updated_at = NOW()
      WHERE id = $1
    `, [user.id]);

    // Generate JWT token
    const token = generateToken({
      id: user.id,
      email: user.email,
      organization_id: user.organization_id,
      role: user.role || 'member',
    });

    return json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        organization_id: user.organization_id,
        organization_name: user.organization_name,
        organization_slug: user.organization_slug,
        role: user.role || 'member',
        email_verified: user.email_verified,
      },
    });

  } catch (error) {
    console.error('Login error:', error);

    return json({
      success: false,
      error: 'An error occurred during login. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, 500);

  } finally {
    await client.end();
  }
}
