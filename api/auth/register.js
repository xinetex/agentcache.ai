import bcryptjs from 'bcryptjs';
import crypto from 'crypto';
import { generateToken } from '../../lib/jwt.js';
import { transaction } from '../../lib/db.js';

const BCRYPT_ROUNDS = 10;

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

function generateApiKey() {
  return 'ac_' + crypto.randomBytes(32).toString('hex');
}

function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password, organizationName, sector, businessDescription } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!organizationName) {
      return res.status(400).json({ error: 'Organization name is required' });
    }

    if (!sector) {
      return res.status(400).json({ error: 'Sector is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    // Hash password
    const passwordHash = await bcryptjs.hash(password, BCRYPT_ROUNDS);

    // Generate organization slug
    const slug = generateSlug(organizationName);

    // Use transaction to create everything atomically
    const result = await transaction(async (client) => {
      // Check if user already exists
      const existingUser = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [email.toLowerCase()]
      );

      if (existingUser.rows.length > 0) {
        throw new Error('An account with this email already exists');
      }

      // Check if org slug already exists
      const existingOrg = await client.query(
        'SELECT id FROM organizations WHERE slug = $1',
        [slug]
      );

      const finalSlug = existingOrg.rows.length > 0
        ? `${slug}-${Date.now().toString(36)}`
        : slug;

      // Create organization
      const orgResult = await client.query(`
        INSERT INTO organizations (
          name, slug, sector, contact_email, plan_tier, 
          max_namespaces, max_api_keys, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, name, slug, sector
      `, [
        organizationName,
        finalSlug,
        sector,
        email.toLowerCase(),
        'starter',
        5,   // max_namespaces for starter
        3,   // max_api_keys for starter
        'active'
      ]);

      const org = orgResult.rows[0];

      // Create user as owner
      const userResult = await client.query(`
        INSERT INTO users (
          email, password_hash, organization_id, role, is_active
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING id, email, organization_id, role
      `, [
        email.toLowerCase(),
        passwordHash,
        org.id,
        'owner',
        true
      ]);

      const user = userResult.rows[0];

      // Create default namespaces based on sector
      const namespaces = [];
      if (sector === 'filestorage') {
        const nsNames = ['storage', 'cdn', 'metadata'];
        for (const name of nsNames) {
          const nsResult = await client.query(`
            INSERT INTO namespaces (
              organization_id, name, display_name, is_active
            ) VALUES ($1, $2, $3, $4)
            RETURNING id, name, display_name
          `, [org.id, name, name.charAt(0).toUpperCase() + name.slice(1), true]);
          namespaces.push(nsResult.rows[0]);
        }
      } else {
        // Default namespace for other sectors
        const nsResult = await client.query(`
          INSERT INTO namespaces (
            organization_id, name, display_name, is_active
          ) VALUES ($1, $2, $3, $4)
          RETURNING id, name, display_name
        `, [org.id, 'default', 'Default', true]);
        namespaces.push(nsResult.rows[0]);
      }

      // Generate API key
      const apiKey = generateApiKey();
      const keyHash = hashApiKey(apiKey);

      await client.query(`
        INSERT INTO api_keys (
          organization_id, key, key_hash, is_active
        ) VALUES ($1, $2, $3, $4)
      `, [org.id, apiKey, keyHash, true]);

      return { user, org, namespaces, apiKey };
    });

    // Generate JWT token
    const token = generateToken({
      userId: result.user.id,
      email: result.user.email,
      organizationId: result.user.organization_id,
      role: result.user.role,
    });

    return res.status(201).json({
      token,
      user: {
        id: result.user.id,
        email: result.user.email,
        organizationId: result.user.organization_id,
        organizationName: result.org.name,
        organizationSlug: result.org.slug,
        role: result.user.role,
      },
      organization: {
        id: result.org.id,
        name: result.org.name,
        slug: result.org.slug,
        sector: result.org.sector,
      },
      namespaces: result.namespaces,
      apiKey: result.apiKey,  // Only shown once!
      message: 'Account created successfully'
    });

  } catch (error) {
    console.error('Registration error:', error);

    if (error.message === 'An account with this email already exists') {
      return res.status(409).json({ error: error.message });
    }

    return res.status(500).json({
      error: 'An error occurred during registration. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
