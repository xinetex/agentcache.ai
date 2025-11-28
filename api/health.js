export const config = { runtime: 'edge' };

export default async function handler(req) {
  const ts = new Date().toISOString();
  const region = req.headers.get('x-vercel-id')?.split(':')[0] || 'unknown';
  return new Response(JSON.stringify({ ok: true, service: 'agentcache', ts, region }), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}
