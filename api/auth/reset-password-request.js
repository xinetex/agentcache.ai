import crypto from 'crypto';
import { query } from '../../lib/db.js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Check if user exists
    const userResult = await query(
      'SELECT id, email FROM users WHERE email = $1 AND is_active = true',
      [email.toLowerCase()]
    );

    // Always return success to prevent email enumeration
    if (userResult.rows.length === 0) {
      return res.status(200).json({ 
        message: 'If an account exists with that email, a reset link has been sent.' 
      });
    }

    const user = userResult.rows[0];

    // Generate reset token (valid for 1 hour)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store reset token in database
    await query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) 
       DO UPDATE SET token_hash = $2, expires_at = $3, created_at = NOW()`,
      [user.id, resetTokenHash, expiresAt]
    );

    // Send reset email
    const resetUrl = `${process.env.VERCEL_URL || 'https://agentcache.ai'}/reset-password.html?token=${resetToken}`;
    
    await resend.emails.send({
      from: 'AgentCache <noreply@agentcache.ai>',
      to: user.email,
      subject: 'Reset Your AgentCache Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0ea5e9;">Reset Your Password</h2>
          <p>You requested to reset your password for AgentCache.</p>
          <p>Click the button below to reset your password:</p>
          <a href="${resetUrl}" 
             style="display: inline-block; background: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
            Reset Password
          </a>
          <p style="color: #666; font-size: 14px;">
            This link will expire in 1 hour.
          </p>
          <p style="color: #666; font-size: 14px;">
            If you didn't request this, you can safely ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">
            AgentCache - LLM Response Caching Platform
          </p>
        </div>
      `
    });

    return res.status(200).json({ 
      message: 'If an account exists with that email, a reset link has been sent.' 
    });

  } catch (error) {
    console.error('Password reset request error:', error);
    return res.status(500).json({ 
      message: 'Failed to process password reset request. Please try again.' 
    });
  }
}
