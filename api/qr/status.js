import { neon } from '@neondatabase/serverless';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req) {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');

    if (!code) {
      return new Response(JSON.stringify({ error: 'Code required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const sql = neon(process.env.DATABASE_URL);

    const pairing = await sql`
      SELECT status, api_key, email FROM qr_pairing_codes 
      WHERE code = ${code}
      LIMIT 1
    `;

    if (!pairing || pairing.length === 0) {
      return new Response(JSON.stringify({ error: 'Code not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = pairing[0];

    if (result.status === 'approved') {
      return new Response(JSON.stringify({
        status: 'approved',
        apiKey: result.api_key,
        email: result.email
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      });
    }

    return new Response(JSON.stringify({
      status: result.status
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    console.error('[QR Status] Error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to check status',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
