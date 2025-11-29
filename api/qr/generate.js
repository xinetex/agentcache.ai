import { neon } from '@neondatabase/serverless';

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    
    // Store in database
    await sql`
      INSERT INTO qr_pairing_codes (code, status, expires_at)
      VALUES (${code}, 'pending', ${expiresAt.toISOString()})
    `;
    
    const qrUrl = `https://agentcache.ai/mobile-auth.html?code=${code}`;
    
    return new Response(JSON.stringify({
      code,
      qrUrl,
      expiresAt: expiresAt.toISOString()
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    console.error('[QR Generate] Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to generate QR code',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
