
import bcryptjs from 'bcryptjs';
import { db } from '../../src/db/client';
import { sql } from 'drizzle-orm';
import { generateToken } from '../../lib/jwt.js';

const BCRYPT_ROUNDS = 10;

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { email, password, name, orgName } = req.body;

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password required' }), { status: 400 });
    }

    // Check if user exists (Raw SQL)
    const check = await db.execute(sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`);
    if (check.length > 0) {
      return new Response(JSON.stringify({ error: 'User already exists' }), { status: 409 });
    }

    // Hash password
    const passwordHash = await bcryptjs.hash(password, BCRYPT_ROUNDS);

    // 1. Create User (Raw SQL)
    const [newUser] = await db.execute(sql`
            INSERT INTO users (email, password_hash, name, role, plan) 
            VALUES (${email}, ${passwordHash}, ${name || email.split('@')[0]}, 'admin', 'free')
            RETURNING *
        `);

    // 2. Create Organization (Raw SQL)
    const slug = (orgName || newUser.name + "'s Org").toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substr(2, 5);

    const [newOrg] = await db.execute(sql`
            INSERT INTO organizations (name, slug, sector, contact_email, plan, region)
            VALUES (${orgName || newUser.name + "'s Org"}, ${slug}, 'general', ${email}, 'free', 'us-east-1')
            RETURNING *
        `);

    // 3. Link Member (Raw SQL)
    await db.execute(sql`
            INSERT INTO members (user_id, org_id, role)
            VALUES (${newUser.id}, ${newOrg.id}, 'owner')
        `);

    // 4. Create API Key (Raw SQL)
    const keyPrefix = 'ac_live_';
    const randomSecret = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);

    console.log("DEBUG: Inserting API Key for OrgID using CORRECT COLUMNS");

    // Introspection Check
    const cols = await db.execute(sql`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'api_keys'
        `);
    console.log("DEBUG: api_keys columns seen by register.js:", cols.map(c => c.column_name).join(', '));

    await db.execute(sql`
            INSERT INTO api_keys (organization_id, key_prefix, key_hash, scopes)
            VALUES (${newOrg.id}, ${keyPrefix}, ${await bcryptjs.hash(randomSecret, 10)}, ${JSON.stringify(['cache:read', 'cache:write'])})
        `);

    // Generate Token
    const token = generateToken({
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
      organizationId: newOrg.id
    });

    return new Response(JSON.stringify({
      success: true,
      user: newUser,
      organization: newOrg,
      apiKey: keyPrefix + randomSecret,
      token
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Register error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
