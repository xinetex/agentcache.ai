export const config = { runtime: 'edge' };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export default async function handler(req) {
  const auth = req.headers.get('authorization') || '';
  const token = (auth.startsWith('Bearer ') ? auth.slice(7) : '');
  if (!token || token !== (process.env.ADMIN_TOKEN || '')) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const key = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !key) return json({ error: 'Service not configured' }, 500);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        commands: [
          ['SCARD', 'subscribers'],
          ['SCARD', 'subscribers:pending'],
          ['SCARD', 'waitlist'],
        ],
      }),
    });
    const arr = await res.json();
    const subscribers = arr?.[0]?.result ?? 0;
    const pending = arr?.[1]?.result ?? 0;
    const waitlist = arr?.[2]?.result ?? 0;

    return json({ subscribers, pending, waitlist, timestamp: new Date().toISOString() });
  } catch (e) {
    return json({ error: 'Unexpected error', details: e?.message || String(e) }, 500);
  }
}
