export const config = { runtime: 'nodejs' };

export default async function handler(req) {
  return new Response(JSON.stringify({ 
    status: 'ok',
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString(),
    env_check: {
      redis_url: !!process.env.UPSTASH_REDIS_REST_URL,
      redis_token: !!process.env.UPSTASH_REDIS_REST_TOKEN,
    }
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}
