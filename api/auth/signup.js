import bcryptjs from 'bcryptjs';
import { generateToken } from '../../lib/jwt.js';
import { transaction } from '../../lib/db.js';
import {
  generateUniqueSlug,
  generateWorkspaceName,
  getPlanLimits,
} from '../../lib/workspace-provisioning.js';

export const config = {
  runtime: 'nodejs'
};

const BCRYPT_ROUNDS = 10;

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Parse body if it's a string (Vercel edge function format)
    let body = req.body;
    if (typeof body === 'string') {
      body = JSON.parse(body);
    }
    const { email, password, full_name } = body;

    // Validate input
    if (!email || !password || !full_name) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }

    const normalizedEmail = email.toLowerCase();
    const passwordHash = await bcryptjs.hash(password, BCRYPT_ROUNDS);

    const { user, organization } = await transaction(async (client) => {
      const existingUser = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [normalizedEmail]
      );

      if (existingUser.rows.length > 0) {
        const conflict = new Error('An account with this email already exists');
        conflict.code = 'USER_EXISTS';
        throw conflict;
      }

      const limits = getPlanLimits('starter');
      const workspaceName = generateWorkspaceName(full_name, normalizedEmail);
      const workspaceSlug = await generateUniqueSlug(client, normalizedEmail.split('@')[0]);

      const userResult = await client.query(`
        INSERT INTO users (
          email, password_hash, full_name, is_active
        ) VALUES ($1, $2, $3, $4)
        RETURNING id, email, full_name
      `, [
        normalizedEmail,
        passwordHash,
        full_name,
        true,
      ]);

      const createdUser = userResult.rows[0];

      const organizationResult = await client.query(`
        INSERT INTO organizations (
          name, slug, sector, contact_email, contact_name,
          plan_tier, max_namespaces, max_api_keys, max_users, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, name, slug, sector, plan_tier
      `, [
        workspaceName,
        workspaceSlug,
        'general',
        normalizedEmail,
        full_name,
        'starter',
        limits.maxNamespaces,
        limits.maxApiKeys,
        limits.maxUsers,
        'active',
      ]);

      const organization = organizationResult.rows[0];

      await client.query(`
        UPDATE users
        SET organization_id = $1, role = 'owner'
        WHERE id = $2
      `, [organization.id, createdUser.id]);

      await client.query(`
        INSERT INTO namespaces (
          organization_id, name, display_name, description, is_active
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (organization_id, name) DO NOTHING
      `, [
        organization.id,
        'default',
        'Default',
        'Default cache namespace for this workspace',
        true,
      ]);

      await client.query(`
        INSERT INTO organization_settings (
          organization_id, namespace_strategy, features, preferences
        ) VALUES ($1, $2, $3::jsonb, $4::jsonb)
        ON CONFLICT (organization_id) DO NOTHING
      `, [
        organization.id,
        'single_tenant',
        JSON.stringify({
          multi_tenant: false,
          sso: false,
          custom_nodes: false,
        }),
        JSON.stringify({
          onboarding_state: 'pending',
          recommended_view: 'core',
        }),
      ]);

      await client.query(`
        INSERT INTO subscriptions (
          user_id, plan_tier, status, current_period_start, current_period_end
        ) VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '1 month')
      `, [
        createdUser.id,
        'starter',
        'active',
      ]);

      return { user: createdUser, organization };
    });

    const token = generateToken({
      id: user.id,
      email: user.email,
      organization_id: organization.id,
      role: 'owner',
    });

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: 'owner',
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          sector: organization.sector,
          plan_tier: organization.plan_tier,
        },
      },
      onboarding: {
        required: true,
        url: '/onboarding.html',
      },
      message: 'Account created successfully',
    });

  } catch (error) {
    if (error?.code === 'USER_EXISTS') {
      return res.status(409).json({ message: error.message });
    }

    console.error('Signup error:', error);

    return res.status(500).json({
      message: 'Registration failed. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
