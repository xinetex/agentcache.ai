import { MoonshotClient } from '../src/lib/moonshot.js';

export const config = { runtime: 'nodejs' };

function json(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'Content-Type, Authorization, X-API-Key, X-Trace-ID',
    },
  });
}

const getEnv = () => ({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function redis(command, ...args) {
  const { url, token } = getEnv();
  if (!url || !token) throw new Error('Upstash not configured');
  const path = `${command}/${args.map(encodeURIComponent).join('/')}`;
  const res = await fetch(`${url}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  const data = await res.json();
  return data.result;
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function auth(req) {
  const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '');
  if (!apiKey || !apiKey.startsWith('ac_')) return { ok: false };
  if (apiKey.startsWith('ac_demo_')) return { ok: true, kind: 'demo', hash: null };
  const hash = await sha256Hex(apiKey);
  const res = await fetch(`${getEnv().url}/hget/key:${hash}/email`, {
    headers: { Authorization: `Bearer ${getEnv().token}` },
    cache: 'no-store'
  });
  if (!res.ok) return { ok: false };
  const email = await res.text();
  if (!email) return { ok: false };
  return { ok: true, kind: 'live', hash, email };
}

function generateTraceId() {
  return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateSpanId() {
  return `span_${Math.random().toString(36).substr(2, 12)}`;
}

async function stableKey({ provider, model, messages, temperature = 0.7 }) {
  const data = { provider, model, messages, temperature };
  const text = JSON.stringify(data);
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  const hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `agentcache:v1:${provider}:${model}:${hex}`;
}

// Model cost estimates (per 1M tokens)
const MODEL_COSTS = {
  'gpt-4': { input: 30, output: 60 },
  'gpt-4-turbo': { input: 10, output: 30 },
  'gpt-4o': { input: 5, output: 15 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'claude-3-opus': { input: 15, output: 75 },
  'claude-3-sonnet': { input: 3, output: 15 },
  'claude-3-haiku': { input: 0.25, output: 1.25 },
  'gemini-pro': { input: 0.5, output: 1.5 },
  'gemini-flash': { input: 0.075, output: 0.3 },
  'deepseek-chat': { input: 0.14, output: 0.28 },
};

function estimateCost(model, inputTokens, outputTokens) {
  const costs = MODEL_COSTS[model] || { input: 1, output: 2 };
  return ((inputTokens * costs.input) + (outputTokens * costs.output)) / 1000000;
}

function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

/**
 * Swarm Strategies:
 * - consensus: All models vote, majority wins
 * - fastest: First to respond wins
 * - cheapest: Use cheapest model first, fallback to others
 * - best-quality: Use highest quality model, cache for others
 * - parallel: Run all, return all results for comparison
 */

async function executeSwarmStrategy(strategy, models, messages, traceId, authn) {
  const results = [];
  const spans = [];

  if (strategy === 'parallel' || strategy === 'consensus') {
    // Execute all models in parallel
    const promises = models.map(async (modelConfig, idx) => {
      const spanId = generateSpanId();
      const spanStart = Date.now();

      try {
        // Check cache first
        const cacheKey = await stableKey({
          provider: modelConfig.provider,
          model: modelConfig.model,
          messages,
          temperature: modelConfig.temperature || 0.7
        });

        const cached = await redis('GET', cacheKey);
        const spanEnd = Date.now();
        const latency = spanEnd - spanStart;

        if (cached) {
          const inputTokens = estimateTokens(JSON.stringify(messages));
          const outputTokens = estimateTokens(cached);
          const cost = estimateCost(modelConfig.model, inputTokens, outputTokens);

          const span = {
            spanId,
            traceId,
            provider: modelConfig.provider,
            model: modelConfig.model,
            startTime: spanStart,
            endTime: spanEnd,
            latency,
            cached: true,
            cost: 0, // Cache hits are free
            estimatedSavings: cost,
            inputTokens,
            outputTokens,
            status: 'success'
          };

          spans.push(span);

          return {
            provider: modelConfig.provider,
            model: modelConfig.model,
            response: cached,
            cached: true,
            latency,
            cost: 0,
            estimatedSavings: cost,
            span
          };
        }

        // Cache miss - call actual LLM
        const client = new MoonshotClient(process.env.MOONSHOT_API_KEY, undefined); // Redis handled via API

        const response = await client.chat(messages, modelConfig.model, modelConfig.temperature);
        const content = response.choices[0].message.content;
        const reasoningTokens = response.usage.reasoning_tokens || 0;

        // Cache the result
        await redis('SETEX', cacheKey, 60 * 60 * 24 * 7, content); // 7 days cache

        const missSpanEnd = Date.now();
        const missLatency = missSpanEnd - spanStart;

        const inputTokens = response.usage.prompt_tokens;
        const outputTokens = response.usage.completion_tokens;
        const cost = estimateCost(modelConfig.model, inputTokens, outputTokens);

        const span = {
          spanId,
          traceId,
          provider: modelConfig.provider,
          model: modelConfig.model,
          startTime: spanStart,
          endTime: missSpanEnd,
          latency: missLatency,
          cached: false,
          cost,
          reasoningTokens,
          inputTokens,
          outputTokens,
          status: 'success'
        };

        spans.push(span);

        return {
          provider: modelConfig.provider,
          model: modelConfig.model,
          response: content,
          cached: false,
          cacheMiss: true,
          cacheKey,
          reasoningTokens,
          span
        };
      } catch (err) {
        const span = {
          spanId,
          traceId,
          provider: modelConfig.provider,
          model: modelConfig.model,
          startTime: spanStart,
          endTime: Date.now(),
          latency: Date.now() - spanStart,
          cached: false,
          status: 'error',
          error: err.message
        };

        spans.push(span);

        return {
          provider: modelConfig.provider,
          model: modelConfig.model,
          error: err.message,
          span
        };
      }
    });

    results.push(...await Promise.all(promises));
  } else if (strategy === 'fastest') {
    // Race all models, return first success
    const promises = models.map(async (modelConfig) => {
      const spanId = generateSpanId();
      const spanStart = Date.now();

      const cacheKey = await stableKey({
        provider: modelConfig.provider,
        model: modelConfig.model,
        messages,
        temperature: modelConfig.temperature || 0.7
      });

      const cached = await redis('GET', cacheKey);

      if (!cached) throw new Error('Cache miss');

      const spanEnd = Date.now();
      const latency = spanEnd - spanStart;
      const inputTokens = estimateTokens(JSON.stringify(messages));
      const outputTokens = estimateTokens(cached);
      const cost = estimateCost(modelConfig.model, inputTokens, outputTokens);

      const span = {
        spanId,
        traceId,
        provider: modelConfig.provider,
        model: modelConfig.model,
        startTime: spanStart,
        endTime: spanEnd,
        latency,
        cached: true,
        cost: 0,
        estimatedSavings: cost,
        status: 'success'
      };

      spans.push(span);

      return {
        provider: modelConfig.provider,
        model: modelConfig.model,
        response: cached,
        cached: true,
        latency,
        winner: true,
        span
      };
    });

    try {
      const winner = await Promise.race(promises);
      results.push(winner);
    } catch (err) {
      // All missed cache
      results.push({
        error: 'All models resulted in cache miss',
        message: 'Use /api/cache/set to populate cache first'
      });
    }
  } else if (strategy === 'cheapest') {
    // Sort by cost, try in order
    const sorted = [...models].sort((a, b) => {
      const aCost = MODEL_COSTS[a.model]?.input || 999;
      const bCost = MODEL_COSTS[b.model]?.input || 999;
      return aCost - bCost;
    });

    for (const modelConfig of sorted) {
      const spanId = generateSpanId();
      const spanStart = Date.now();

      try {
        const cacheKey = await stableKey({
          provider: modelConfig.provider,
          model: modelConfig.model,
          messages,
          temperature: modelConfig.temperature || 0.7
        });

        const cached = await redis('GET', cacheKey);

        if (cached) {
          const spanEnd = Date.now();
          const latency = spanEnd - spanStart;

          const span = {
            spanId,
            traceId,
            provider: modelConfig.provider,
            model: modelConfig.model,
            startTime: spanStart,
            endTime: spanEnd,
            latency,
            cached: true,
            status: 'success'
          };

          spans.push(span);

          results.push({
            provider: modelConfig.provider,
            model: modelConfig.model,
            response: cached,
            cached: true,
            latency,
            strategy: 'cheapest',
            span
          });
          break;
        }
      } catch (err) {
        continue;
      }
    }

    if (results.length === 0) {
      results.push({
        error: 'All models resulted in cache miss',
        triedInOrder: sorted.map(m => `${m.provider}/${m.model}`)
      });
    }
  }

  // Store trace data
  const trace = {
    traceId,
    strategy,
    timestamp: Date.now(),
    models: models.length,
    spans,
    results,
    totalLatency: Math.max(...spans.map(s => s.latency || 0)),
    cacheHits: spans.filter(s => s.cached).length,
    cacheMisses: spans.filter(s => !s.cached && s.status !== 'error').length,
    errors: spans.filter(s => s.status === 'error').length,
  };

  // Store trace for 7 days
  await redis('SETEX', `trace:${traceId}`, 60 * 60 * 24 * 7, JSON.stringify(trace));

  // Track swarm metrics
  const today = new Date().toISOString().slice(0, 10);
  await redis('INCR', `stats:swarm:requests:d:${today}`);
  await redis('EXPIRE', `stats:swarm:requests:d:${today}`, 60 * 60 * 24 * 7);

  if (authn.kind === 'live') {
    await redis('HINCRBY', `usage:${authn.hash}`, 'swarm_requests', 1);
  }

  return { trace, results };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return json({ ok: true });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const authn = await auth(req);
    if (!authn.ok) return json({ error: 'Invalid API key' }, 401);

    const body = await req.json();
    const {
      models = [],
      messages = [],
      strategy = 'parallel',
      traceId = req.headers.get('x-trace-id') || generateTraceId()
    } = body;

    // Validation
    if (!Array.isArray(models) || models.length === 0) {
      return json({ error: 'models array is required and must not be empty' }, 400);
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: 'messages array is required and must not be empty' }, 400);
    }

    if (!['parallel', 'consensus', 'fastest', 'cheapest', 'best-quality'].includes(strategy)) {
      return json({ error: 'Invalid strategy. Must be: parallel, consensus, fastest, cheapest, or best-quality' }, 400);
    }

    // Validate each model config
    for (const model of models) {
      if (!model.provider || !model.model) {
        return json({ error: 'Each model must have provider and model fields' }, 400);
      }
    }

    // Execute swarm strategy
    const { trace, results } = await executeSwarmStrategy(
      strategy,
      models,
      messages,
      traceId,
      authn
    );

    // Calculate cache hit rate safely
    const totalRequests = trace.cacheHits + trace.cacheMisses;
    const cacheHitRate = totalRequests > 0 ? (trace.cacheHits / totalRequests * 100) : 0;

    return json({
      success: true,
      traceId,
      strategy,
      models: models.length,
      results,
      observability: {
        traceUrl: `/api/trace?id=${traceId}`,
        dashboardUrl: `/swarm-observability.html?traceId=${traceId}`,
        totalLatency: trace.totalLatency,
        cacheHits: trace.cacheHits,
        cacheMisses: trace.cacheMisses,
        cacheHitRate: Math.round(cacheHitRate * 10) / 10, // Round to 1 decimal
        errors: trace.errors
      }
    });

  } catch (err) {
    console.error('Swarm error:', err);
    return json({
      error: 'Swarm execution failed',
      details: err?.message || String(err)
    }, 500);
  }
}
