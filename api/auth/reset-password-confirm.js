import crypto from 'crypto';
import bcryptjs from 'bcryptjs';
import { query } from '../../lib/db.js';

const BCRYPT_ROUNDS = 10;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }

    // Hash the token to look it up
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find valid reset token
    const tokenResult = await query(
      `SELECT prt.user_id, prt.expires_at, u.email
       FROM password_reset_tokens prt
       JOIN users u ON prt.user_id = u.id
       WHERE prt.token_hash = $1 AND prt.expires_at > NOW()`,
      [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    const { user_id } = tokenResult.rows[0];

    // Hash new password
    const passwordHash = await bcryptjs.hash(newPassword, BCRYPT_ROUNDS);

    // Update user's password
    await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, user_id]
    );

    // Delete used reset token
    await query(
      'DELETE FROM password_reset_tokens WHERE user_id = $1',
      [user_id]
    );

    return res.status(200).json({ 
      message: 'Password reset successfully. You can now log in with your new password.' 
    });

  } catch (error) {
    console.error('Password reset confirm error:', error);
    return res.status(500).json({ 
      message: 'Failed to reset password. Please try again.' 
    });
  }
}
