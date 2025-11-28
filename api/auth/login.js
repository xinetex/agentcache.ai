import bcrypt from 'bcryptjs';
import { generateToken } from '../../lib/jwt.js';
import { query } from '../../lib/db.js';

export const config = {
  runtime: 'nodejs'
};

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

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle OPTIONS for CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse body if it's a string (Vercel edge function format)
    let body = req.body;
    if (typeof body === 'string') {
      body = JSON.parse(body);
    }
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format'
      });
    }

    // Find user by email
    const userResult = await query(`
      SELECT *
      FROM users
      WHERE email = $1 AND is_active = true
    `, [email.toLowerCase()]);

    if (userResult.rows.length === 0) {
      // Don't reveal whether user exists
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    const user = userResult.rows[0];

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    // Update last login timestamp
    await query(`
      UPDATE users 
      SET updated_at = NOW()
      WHERE id = $1
    `, [user.id]);

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      organizationId: user.organization_id,
      role: user.role || 'member',
    });

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        organizationId: user.organization_id || null,
        role: user.role || 'member',
        emailVerified: user.email_verified || false,
      },
    });

  } catch (error) {
    console.error('Login error:', error);

    return res.status(500).json({
      error: 'An error occurred during login. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
