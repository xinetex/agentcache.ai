import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';

export const config = {
  runtime: 'nodejs20.x',
};

// Import provisioning logic
async function generateApiKey(userId, integration, projectId) {
  const sql = neon(process.env.DATABASE_URL);
  const bcrypt = await import('bcryptjs');
  
  const randomBytes = crypto.randomBytes(32).toString('hex');
  const key = `ac_${integration}_${randomBytes}`;
  
  const keyHash = await bcrypt.hash(key, 10);
  const keyPrefix = key.substring(0, 12);
  
  await sql`
    INSERT INTO api_keys (user_id, key_hash, key_prefix, scopes, allowed_namespaces)
    VALUES (
      ${userId},
      ${keyHash},
      ${keyPrefix},
      '["cache:read", "cache:write"]'::jsonb,
      '["*"]'::jsonb
    )
  `;
  
  return key;
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await req.json();
    const { code, email } = body;
    
    if (!code || !email) {
      return new Response(JSON.stringify({ error: 'Code and email required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const sql = neon(process.env.DATABASE_URL);
    
    // Verify code exists and is pending
    const pairing = await sql`
      SELECT * FROM qr_pairing_codes 
      WHERE code = ${code} AND status = 'pending' AND expires_at > NOW()
      LIMIT 1
    `;
    
    if (!pairing || pairing.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid or expired code' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Generate API key
    const userId = email.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const apiKey = await generateApiKey(userId, 'qr_auth', `qr_${Date.now()}`);
    
    // Set quota in Upstash Redis
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    
    await fetch(`${redisUrl}/set/usage:${keyHash}:quota/10000`, {
      headers: { Authorization: `Bearer ${redisToken}` }
    });
    
    // Update pairing record
    await sql`
      UPDATE qr_pairing_codes 
      SET status = 'approved', 
          email = ${email},
          api_key = ${apiKey},
          approved_at = NOW()
      WHERE code = ${code}
    `;
    
    return new Response(JSON.stringify({
      success: true,
      message: 'API key provisioned'
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    console.error('[QR Approve] Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to approve',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
