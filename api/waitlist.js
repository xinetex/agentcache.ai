export const config = { runtime: 'edge' };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { email } = await req.json();
    if (!email || typeof email !== 'string') return json({ error: 'Email required' }, 400);

    // Basic email validation
    const ok = /.+@.+\..+/.test(email);
    if (!ok) return json({ error: 'Invalid email' }, 400);

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      return json({ error: 'Service not configured' }, 500);
    }

    const ua = req.headers.get('user-agent') || '';
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim() || '';
    const now = new Date().toISOString();

    // Pipeline: add to set + store metadata
    const payload = {
      commands: [
        ['SADD', 'waitlist', email],
        ['HSET', `waitlist:${email}`, 'email', email, 'createdAt', now, 'ip', ip, 'ua', ua],
      ],
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      return json({ error: 'Upstash error', details: text }, 502);
    }

    return json({ success: true });
  } catch (err: any) {
    return json({ error: 'Unexpected error', details: err?.message || String(err) }, 500);
  }
}
