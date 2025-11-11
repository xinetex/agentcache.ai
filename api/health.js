export const config = { runtime: 'edge' };

export default async function handler() {
  return new Response(JSON.stringify({ status: 'healthy', service: 'AgentCache.ai', timestamp: new Date().toISOString() }), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
