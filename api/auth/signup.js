import bcryptjs from 'bcryptjs';
import { generateToken } from '../../lib/jwt.js';
import { query } from '../../lib/db.js';

const BCRYPT_ROUNDS = 10;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { email, password, full_name } = req.body;

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

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    // Hash password
    const passwordHash = await bcryptjs.hash(password, BCRYPT_ROUNDS);

    // Create user (without organization for now - matches existing system)
    const userResult = await query(`
      INSERT INTO users (
        email, password_hash, full_name, is_active
      ) VALUES ($1, $2, $3, $4)
      RETURNING id, email, full_name
    `, [
      email.toLowerCase(),
      passwordHash,
      full_name,
      true
    ]);

    const user = userResult.rows[0];

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      organizationId: null,
      role: 'member',
    });

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
      },
      message: 'Account created successfully'
    });

  } catch (error) {
    console.error('Signup error:', error);

    return res.status(500).json({
      message: 'Registration failed. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
