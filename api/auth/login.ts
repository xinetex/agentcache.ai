import * as bcrypt from 'bcryptjs';
import { generateToken } from '../../lib/jwt.js';
import { query } from '../../lib/db.js';

export const config = {
  runtime: 'nodejs'
};

function isPasswordHash(value: any) {
  return typeof value === 'string' && value.startsWith('$2');
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      body = JSON.parse(body);
    }

    const { email, password } = body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const userResult = await query(`
      SELECT
        u.id,
        u.email,
        u.password_hash,
        u.full_name,
        u.role,
        u.organization_id,
        u.is_active,
        o.name AS organization_name,
        o.slug AS organization_slug,
        o.sector AS organization_sector,
        o.plan_tier AS organization_plan_tier
      FROM users u
      LEFT JOIN organizations o ON o.id = u.organization_id
      WHERE u.email = $1
      LIMIT 1
    `, [normalizedEmail]);

    const user = userResult.rows[0];

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!isPasswordHash(user.password_hash)) {
      return res.status(401).json({
        error: 'This account uses a different sign-in method. Use the provider you signed up with.'
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      organization_id: user.organization_id,
      role: user.role || 'member'
    });

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role || 'member',
        organization: user.organization_id ? {
          id: user.organization_id,
          name: user.organization_name,
          slug: user.organization_slug,
          sector: user.organization_sector,
          plan_tier: user.organization_plan_tier,
        } : null,
      },
      onboarding: {
        required: !user.organization_id,
        url: !user.organization_id ? '/onboarding.html' : null,
      }
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
