import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

const sql = neon(process.env.DATABASE_URL);

/**
 * Admin endpoint to reset a user's password
 * POST /api/admin/reset-password
 * 
 * Body: { email, newPassword, adminToken }
 */
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, newPassword, adminToken } = req.body;

    // Validate admin token
    if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized - Invalid admin token' });
    }

    // Validate input
    if (!email || !newPassword) {
      return res.status(400).json({ error: 'Email and newPassword required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Find user
    const users = await sql`
      SELECT id, email, full_name, is_active
      FROM users
      WHERE email = ${email.toLowerCase()}
    `;

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await sql`
      UPDATE users
      SET password_hash = ${passwordHash}, updated_at = NOW()
      WHERE id = ${user.id}
    `;

    // Activate account if inactive
    if (!user.is_active) {
      await sql`
        UPDATE users
        SET is_active = true
        WHERE id = ${user.id}
      `;
    }

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully',
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        is_active: true
      }
    });

  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
