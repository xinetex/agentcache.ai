export const config = { runtime: 'edge' };

export default async function handler(req) {
  try {
    const u = new URL(req.url);
    const token = u.searchParams.get('token');
    if (!token) {
      return new Response('Missing token', { status: 400 });
    }

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const auth = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !auth) return new Response('Service not configured', { status: 500 });

    // Resolve token -> email
    const getRes = await fetch(`${url}/get/verify:${token}`, {
      headers: { Authorization: `Bearer ${auth}` },
      cache: 'no-store',
    });
    const email = await getRes.text();
    if (!getRes.ok || !email) {
      return new Response('Invalid or expired token', { status: 400 });
    }

    const now = new Date().toISOString();
    // Promote to active
    const pipeline = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        commands: [
          ['DEL', `verify:${token}`],
          ['SREM', 'subscribers:pending', email],
          ['SADD', 'subscribers', email],
          ['HSET', `subscriber:${email}`, 'status', 'active', 'verifiedAt', now],
        ],
      }),
    });
    if (!pipeline.ok) return new Response('Failed to update status', { status: 500 });

    return new Response(null, { status: 302, headers: { Location: `/thanks.html?email=${encodeURIComponent(email)}` } });
  } catch (err) {
    return new Response('Unexpected error', { status: 500 });
  }
}
