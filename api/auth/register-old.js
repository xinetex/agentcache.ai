import bcryptjs from 'bcryptjs';
import { generateToken } from '../../lib/jwt.js';
import { query, transaction } from '../../lib/db.js';

/**
 * POST /api/auth/register
 * Register a new customer user account
 * 
 * Request body:
 * {
 *   email: string,
 *   password: string,
 *   full_name: string,
 *   organization_id?: string (optional, for adding user to existing org)
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   token: string,
 *   user: { id, email, organization_id, role }
 * }
 */

const BCRYPT_ROUNDS = 10;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password, fullName, organizationName, sector, businessDescription } = req.body;

    // Validate input
    if (!email || !password) {
      return json({
        success: false,
        error: 'Email and password are required'
      }, 400);
    }

    if (!full_name) {
      return json({
        success: false,
        error: 'Full name is required'
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

    // Validate password strength (min 8 chars)
    if (password.length < 8) {
      return json({
        success: false,
        error: 'Password must be at least 8 characters long'
      }, 400);
    }

    await client.connect();

    // Check if user already exists
    const existingUser = await client.query(`
      SELECT id FROM users WHERE email = $1
    `, [email.toLowerCase()]);

    if (existingUser.rows.length > 0) {
      return json({
        success: false,
        error: 'An account with this email already exists'
      }, 409);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Determine role (owner if no org, member if joining existing org)
    const role = organization_id ? 'member' : null;

    // Create user
    const userResult = await client.query(`
      INSERT INTO users (
        email, 
        password_hash, 
        full_name, 
        organization_id,
        role,
        is_active,
        email_verified
      ) VALUES ($1, $2, $3, $4, $5, true, false)
      RETURNING id, email, full_name, organization_id, role, created_at
    `, [
      email.toLowerCase(),
      passwordHash,
      full_name,
      organization_id || null,
      role
    ]);

    const user = userResult.rows[0];

    // Get organization details if user has one
    let organizationDetails = null;
    if (user.organization_id) {
      const orgResult = await client.query(`
        SELECT name, slug, status FROM organizations WHERE id = $1
      `, [user.organization_id]);
      
      if (orgResult.rows.length > 0) {
        organizationDetails = orgResult.rows[0];
      }
    }

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
        organization_name: organizationDetails?.name,
        organization_slug: organizationDetails?.slug,
        role: user.role || 'member',
        email_verified: false,
        created_at: user.created_at,
      },
      message: 'Account created successfully'
    }, 201);

  } catch (error) {
    console.error('Registration error:', error);

    // Handle unique constraint violations
    if (error.code === '23505') { // PostgreSQL unique violation
      return json({
        success: false,
        error: 'An account with this email already exists'
      }, 409);
    }

    return json({
      success: false,
      error: 'An error occurred during registration. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, 500);

  } finally {
    await client.end();
  }
}
