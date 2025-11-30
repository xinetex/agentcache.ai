/**
 * Game Loop (single tick)
 * - Simulates agent requests to exercise cache set/get flows
 * - Updates game metrics in Redis for visualization
 * Trigger: Vercel cron or manual call
 */

export const config = { runtime: 'edge' };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    },
  });
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// 10 base prompts for predictable L2 hits
const BASE_PROMPTS = [
  'explain react hooks',
  'python list comprehension',
  'sql join types',
  'rest vs graphql',
  'docker vs kubernetes',
  'typescript generics intro',
  'go routines vs threads',
  'json schema basics',
  'jwt vs session cookie',
  'event driven architecture overview'
];

export default async function handler(req) {
  try {
    const API_BASE = process.env.PUBLIC_URL || 'https://agentcache.ai';
    const apiKey = process.env.GAME_API_KEY || 'ac_demo_test123';
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!redisUrl || !redisToken) return json({ error: 'Redis not configured' }, 500);

    // Scenario selection
    // 0: repeat exact (expected hit after first time)
    // 1: small variation (miss → set)
    // 2: gated private namespace (403 expected on free)
    // 3: short TTL churn (set with small ttl, then re-get)
    const scenario = Math.random() < 0.6 ? 0 : Math.random() < 0.8 ? 1 : Math.random() < 0.9 ? 2 : 3;

    const base = pick(BASE_PROMPTS);
    const variantSuffix = Math.random().toString(36).slice(2, 6);
    const prompt = scenario === 1 ? `${base} ${variantSuffix}` : base;

    const body = {
      provider: 'openai',
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
    };

    let result = { tier: 'L2', hit: false, status: 0, scenario };
    const headers = { 'Content-Type': 'application/json', 'X-API-Key': apiKey };

    if (scenario === 2) {
      // Private namespace gate
      const res = await fetch(`${API_BASE}/api/cache/set`, {
        method: 'POST', headers,
        body: JSON.stringify({ ...body, ttl: 60, response: 'gate-check', namespace: 'private_ns' }),
      });
      result.status = res.status;
      result.hit = false;
      result.gated = res.status === 403;
    } else {
      // Try get
      const getRes = await fetch(`${API_BASE}/api/cache/get`, {
        method: 'POST', headers, body: JSON.stringify(body),
      });
      result.status = getRes.status;
      if (getRes.ok) {
        const js = await getRes.json().catch(() => ({}));
        result.hit = !!js.hit;
      }
      if (!getRes.ok) {
        // Miss → set
        const setRes = await fetch(`${API_BASE}/api/cache/set`, {
          method: 'POST', headers,
          body: JSON.stringify({ ...body, ttl: scenario === 3 ? 15 : 120, response: `ok:${base}` }),
        });
        result.setStatus = setRes.status;
      }
    }

    // Update metrics in Redis (pipeline)
    const now = Date.now();
    const incrs = [];
    incrs.push(['INCR', 'game:total']);
    if (scenario === 2) incrs.push(['INCR', 'game:gated']);
    if (result.hit) incrs.push(['INCR', 'game:hits']); else incrs.push(['INCR', 'game:misses']);
    // Track tier distribution (we only use L2 today)
    incrs.push(['INCR', result.hit ? 'game:l2' : 'game:llm']);
    // Rolling window timestamps
    incrs.push(['LPUSH', 'game:events', JSON.stringify({ t: now, scenario, base, prompt, hit: result.hit, status: result.status })]);
    incrs.push(['LTRIM', 'game:events', '0', '99']);

    await fetch(redisUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${redisToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands: incrs })
    });

    return json({ success: true, result });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
