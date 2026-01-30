import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

/**
 * Admin endpoint to check user status
 * POST /api/admin/check-user
 * 
 * Body: { email, adminToken }
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
    const { email, adminToken } = req.body;

    // Validate admin token
    if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    // Find user
    const users = await sql`
      SELECT 
        id, 
        email, 
        full_name, 
        is_active,
        email_verified,
        organization_id,
        role,
        created_at,
        updated_at,
        LENGTH(password_hash) as password_length
      FROM users
      WHERE email = ${email.toLowerCase()}
    `;

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];

    // Check subscriptions
    const subs = await sql`
      SELECT plan_tier, status, current_period_end
      FROM subscriptions
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        is_active: user.is_active,
        email_verified: user.email_verified,
        role: user.role,
        organization_id: user.organization_id,
        created_at: user.created_at,
        updated_at: user.updated_at,
        has_password: user.password_length > 0,
        password_hash_length: user.password_length
      },
      subscription: subs.length > 0 ? {
        plan: subs[0].plan_tier,
        status: subs[0].status,
        expires: subs[0].current_period_end
      } : null,
      database_url_set: !!process.env.DATABASE_URL,
      jwt_secret_set: !!process.env.JWT_SECRET
    });

  } catch (error) {
    console.error('Check user error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      database_url_set: !!process.env.DATABASE_URL
    });
  }
}
