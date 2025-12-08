
import bcrypt from 'bcryptjs';
import { generateToken } from '../../lib/jwt.js';
import { db } from '../../src/db/client';
import { sql } from 'drizzle-orm';
import { users } from '../../src/db/schema';
import { eq } from 'drizzle-orm';

export const config = {
  runtime: 'nodejs'
};

export default async function handler(req, res) {
  // CORS wrappers standard
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password required' }), { status: 400 });
    }

    // Find user by email (Raw SQL)
    const usersFound = await db.execute(sql`
        SELECT id, email, password_hash, role, plan, name
        FROM users
        WHERE email = ${email.toLowerCase()}
        LIMIT 1
    `);

    const user = usersFound[0];

    // Check if user exists
    if (!user || !user.password_hash) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 });
    }

    // Token Generation
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: 'org_placeholder' // TODO: Join members table to get this
    });

    return new Response(JSON.stringify({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        plan: user.plan
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Login error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
