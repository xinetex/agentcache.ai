/**
 * Authentication API
 * Handles user registration, login, and JWT token management
 */

import { neon } from '@neondatabase/serverless';

export const config = {
  runtime: 'nodejs'
};
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const sql = neon(process.env.DATABASE_URL);
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d'; // Token valid for 7 days

/**
 * Generate JWT token for user
 */
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Verify JWT token
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Extract user from Authorization header
 */
export async function getUserFromRequest(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);

  if (!decoded) {
    return null;
  }

  // Fetch full user from database
  const users = await sql`
    SELECT id, email, full_name, created_at, stripe_customer_id
    FROM users
    WHERE id = ${decoded.id} AND is_active = TRUE
  `;

  return users[0] || null;
}

/**
 * Middleware to require authentication
 */
export async function requireAuth(handler) {
  return async (req, res) => {
    const user = await getUserFromRequest(req);

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Valid authentication token required'
      });
    }

    // Attach user to request
    req.user = user;

    return handler(req, res);
  };
}

/**
 * Main API handler
 */
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { method, url } = req;
  const path = url.split('?')[0];

  try {
    // POST /api/auth/signup
    if (method === 'POST' && path === '/api/auth/signup') {
      const { email, password, full_name } = req.body;

      // Validation
      if (!email || !password) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Email and password required'
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Password must be at least 8 characters'
        });
      }

      // Check if user exists
      const existing = await sql`
        SELECT id FROM users WHERE email = ${email}
      `;

      if (existing.length > 0) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'User with this email already exists'
        });
      }

      // Hash password
      const password_hash = await bcrypt.hash(password, 10);

      // Create user
      const users = await sql`
        INSERT INTO users (email, password_hash, full_name)
        VALUES (${email}, ${password_hash}, ${full_name || null})
        RETURNING id, email, full_name, created_at
      `;

      const user = users[0];

      // Create default settings
      await sql`
        INSERT INTO user_settings (user_id, enabled_sectors)
        VALUES (${user.id}, '{"healthcare": false, "finance": false, "legal": false}'::jsonb)
      `;

      // Create starter subscription (free tier)
      const subscriptions = await sql`
        INSERT INTO subscriptions (
          user_id, 
          plan_tier, 
          status, 
          current_period_start, 
          current_period_end
        )
        VALUES (
          ${user.id},
          'starter',
          'active',
          NOW(),
          NOW() + INTERVAL '1 month'
        )
        RETURNING *
      `;

      // Generate token
      const token = generateToken(user);

      return res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          created_at: user.created_at
        },
        subscription: {
          plan: subscriptions[0].plan_tier,
          status: subscriptions[0].status
        },
        token
      });
    }

    // POST /api/auth/login
    if (method === 'POST' && path === '/api/auth/login') {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Email and password required'
        });
      }

      // Find user
      const users = await sql`
        SELECT id, email, password_hash, full_name, created_at, stripe_customer_id
        FROM users
        WHERE email = ${email} AND is_active = TRUE
      `;

      if (users.length === 0) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'Invalid email or password'
        });
      }

      const user = users[0];

      // Verify password
      const valid = await bcrypt.compare(password, user.password_hash);

      if (!valid) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'Invalid email or password'
        });
      }

      // Get subscription
      const subscriptions = await sql`
        SELECT plan_tier, status
        FROM subscriptions
        WHERE user_id = ${user.id} AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1
      `;

      // Generate token
      const token = generateToken(user);

      return res.status(200).json({
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          created_at: user.created_at
        },
        subscription: subscriptions.length > 0 ? {
          plan: subscriptions[0].plan_tier,
          status: subscriptions[0].status
        } : null,
        token
      });
    }

    // GET /api/auth/me
    if (method === 'GET' && path === '/api/auth/me') {
      const user = await getUserFromRequest(req);

      if (!user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid or expired token'
        });
      }

      // Get subscription
      const subscriptions = await sql`
        SELECT plan_tier, status, current_period_start, current_period_end
        FROM subscriptions
        WHERE user_id = ${user.id} AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1
      `;

      // Get pipeline count
      const pipelineCounts = await sql`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active
        FROM pipelines
        WHERE user_id = ${user.id} AND status != 'archived'
      `;

      return res.status(200).json({
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          created_at: user.created_at
        },
        subscription: subscriptions.length > 0 ? {
          plan: subscriptions[0].plan_tier,
          status: subscriptions[0].status,
          period_start: subscriptions[0].current_period_start,
          period_end: subscriptions[0].current_period_end
        } : null,
        pipelines: {
          total: parseInt(pipelineCounts[0].total),
          active: parseInt(pipelineCounts[0].active)
        }
      });
    }

    // POST /api/auth/logout
    if (method === 'POST' && path === '/api/auth/logout') {
      // With JWT, logout is handled client-side (delete token)
      // For enhanced security, you could implement token blacklist here
      return res.status(200).json({
        message: 'Logged out successfully'
      });
    }

    // Route not found
    return res.status(404).json({
      error: 'Not found',
      message: 'Auth endpoint not found'
    });

  } catch (error) {
    console.error('Auth API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
