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

    // 1. Fetch Active Genome (DNA) from Evolution Engine
    const evoRes = await fetch(`${API_BASE}/api/game/evolution`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_active' })
    });

    let genome;
    if (evoRes.ok) {
      const data = await evoRes.json();
      genome = data.genome;
    }

    // Fallback to random if no population
    if (!genome) {
      genome = { id: 'random_fallback', l1: { ttl: 60 }, model: { provider: 'openai' } };
    }

    // 2. Execute Simulation using Genome Config
    const base = pick(BASE_PROMPTS);
    const prompt = `${base} ${Math.random().toString(36).slice(2, 6)}`;

    // Simulate latency based on Genome (Mocking the "Effect" of genes)
    // In a real system, we'd configure the actual cache with these params.
    // Here we simulate the performance characteristics to train the GA.

    let latencyMs = 0;
    let hit = false;

    // Simulation Logic (The "Physics" of the Game)
    // L1 hit?
    if (genome.l1?.enabled && Math.random() < 0.8) {
      latencyMs = 5;
      hit = true;
    }
    // L2 hit? (if L1 missed)
    else if (genome.l2?.enabled && Math.random() < 0.6) {
      latencyMs = 50;
      hit = true;
    }
    // LLM Call (Miss)
    else {
      latencyMs = genome.model?.provider === 'anthropic' ? 800 : 500;
      hit = false;
    }

    // 3. Report Metrics back to Evolution Engine (Fitness Feedback)
    // We store this in Redis so the `evolve` step can read it.
    const METRICS_KEY = 'game:evolution:metrics';

    // Fetch current metrics for this genome
    const currentMetricsRes = await fetch(`${redisUrl}/hget/${METRICS_KEY}/${genome.id}`, {
      headers: { Authorization: `Bearer ${redisToken}` }
    });

    let currentMetrics = { hits: 0, misses: 0, avgLatency: 0, count: 0 };
    if (currentMetricsRes.ok) {
      const raw = await currentMetricsRes.json();
      if (raw.result) currentMetrics = JSON.parse(raw.result);
    }

    // Update Accumulator
    currentMetrics.count++;
    if (hit) currentMetrics.hits++; else currentMetrics.misses++;
    // Rolling Average
    currentMetrics.avgLatency = ((currentMetrics.avgLatency * (currentMetrics.count - 1)) + latencyMs) / currentMetrics.count;

    // Save back
    await fetch(`${redisUrl}/hset/${METRICS_KEY}/${genome.id}/${JSON.stringify(currentMetrics)}`, {
      headers: { Authorization: `Bearer ${redisToken}` }
    });

    return json({
      success: true,
      genomeId: genome.id,
      generation: genome.generation,
      result: { hit, latencyMs }
    });

  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
