export const config = { runtime: 'edge' };

export default async function handler() {
  try {
    const url = (typeof process !== 'undefined' && process.env && process.env.UPSTASH_REDIS_REST_URL) || '';
    const token = (typeof process !== 'undefined' && process.env && process.env.UPSTASH_REDIS_REST_TOKEN) || '';
    if (!url || !token) {
      return new Response(JSON.stringify({ ok: false, error: 'Upstash env not set' }), { status: 500, headers: { 'content-type': 'application/json' } });
    }
    const res = await fetch(`${url}/ping`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    const pong = data?.result || data || null;
    if (!res.ok) {
      return new Response(JSON.stringify({ ok: false, status: res.status, pong }), { status: 500, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ ok: true, pong: pong || 'PONG' }), { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}