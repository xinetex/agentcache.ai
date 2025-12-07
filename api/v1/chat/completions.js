/**
 * OpenAI-Compatible Proxy Endpoint
 * 
 * Drop-in replacement for OpenAI API with automatic caching.
 * Agents just change: OPENAI_BASE_URL=https://agentcache.ai
 * 
 * Flow:
 * 1. Receive OpenAI-format request
 * 2. Check cache (SHA-256 hash of messages + model + temperature)
 * 3. Return cached response if exists (with X-Cache: HIT header)
 * 4. On miss: proxy to real OpenAI API OR RouteLLM
 * 5. Store response in cache
 * 6. Return to agent
 */

export const config = { runtime: 'nodejs' };

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Helper: JSON response
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers
    },
  });
}

// Helper: Upstash Redis REST API call
async function redis(command, ...args) {
  const response = await fetch(`${UPSTASH_URL}/${command}/${args.join('/')}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
  });
  const data = await response.json();
  return data.result;
}

// Helper: Generate cache key (deterministic hash)
async function generateCacheKey(request) {
  const { model, messages, temperature = 1.0, top_p, frequency_penalty, presence_penalty } = request;

  const cacheInput = {
    model,
    messages,
    temperature,
    top_p,
    frequency_penalty,
    presence_penalty
  };

  const msgString = JSON.stringify(cacheInput);
  const msgBuffer = new TextEncoder().encode(msgString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return `agentcache:v1:openai:${model}:${hashHex}`;
}

// Helper: Authenticate API key
async function authenticate(req) {
  // Get API key from header (OpenAI format or AgentCache format)
  let apiKey = req.headers.get('x-api-key');

  if (!apiKey) {
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      apiKey = authHeader.replace('Bearer ', '');
    }
  }

  if (!apiKey) {
    return { ok: false, error: 'Missing API key' };
  }

  // Demo keys (unlimited for testing)
  if (apiKey.startsWith('ac_demo_')) {
    return { ok: true, kind: 'demo', apiKey };
  }

  // Live keys (validate via Redis)
  if (!apiKey.startsWith('ac_live_')) {
    return { ok: false, error: 'Invalid API key format' };
  }

  const hash = await hashApiKey(apiKey);
  const email = await redis('HGET', `key:${hash}`, 'email');

  if (!email) {
    return { ok: false, error: 'Invalid API key' };
  }

  // Check quota
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const usageKey = `usage:${hash}:m:${monthKey}`;
  const usage = parseInt(await redis('GET', usageKey) || '0');
  const quota = parseInt(await redis('HGET', `usage:${hash}`, 'monthlyQuota') || '10000');

  if (usage >= quota) {
    return { ok: false, error: 'Monthly quota exceeded', quota: { used: usage, limit: quota } };
  }

  return { ok: true, kind: 'live', apiKey, hash, email, usage, quota };
}

// Helper: Hash API key
async function hashApiKey(apiKey) {
  const msgBuffer = new TextEncoder().encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper: Increment usage
async function incrementUsage(hash) {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const usageKey = `usage:${hash}:m:${monthKey}`;

  // Increment monthly usage
  await redis('INCR', usageKey);

  // Set expiry to end of next month
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 1);
  const ttl = Math.floor((nextMonth - now) / 1000);
  await redis('EXPIRE', usageKey, ttl);
}

// Helper: Track cache hit/miss
async function trackCacheMetrics(hash, hit) {
  if (hit) {
    await redis('HINCRBY', `usage:${hash}`, 'hits', 1);
  } else {
    await redis('HINCRBY', `usage:${hash}`, 'misses', 1);
  }
}

// Main handler
export default async function handler(req) {
  // Only POST allowed
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  // Authenticate
  const auth = await authenticate(req);
  if (!auth.ok) {
    return json({ error: auth.error, quota: auth.quota }, 401);
  }

  // Rate Limit Check
  const { RateLimiter } = await import('../../limiter.js');
  const isRateLimited = !(await RateLimiter.check(auth.hash));
  if (isRateLimited) {
    return json({
      error: {
        message: 'Rate limit exceeded. Default limit is 60 RPM.',
        type: 'rate_limit_exceeded',
        code: 'RATE_LIMIT'
      }
    }, 429);
  }

  try {
    // Parse request body
    const body = await req.json();

    // Validate required fields
    if (!body.model || !body.messages) {
      return json({ error: 'Missing required fields: model, messages' }, 400);
    }

    // --- POLICY ENGINE START ---
    const { PolicyEngine } = await import('../../policy.js');
    const { CognitiveSentinel } = await import('../../cognitive.js');

    // Helper: Trigger webhook (inline for now to avoid dep cycle)
    async function triggerWebhook(apiKeyHash, eventType, data) {
      try {
        const webhookUrl = `${new URL('/api/webhooks/trigger', 'https://agentcache.ai')}`;
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key_hash: apiKeyHash,
            event: eventType,
            data
          })
        });
      } catch (err) {
        // Silently fail for webhooks to not interrupt flow
        console.error('Webhook trigger failed:', err);
      }
    }

    // Use Authenticated Key for Policy checks (if needed for API calls) generally we use process env inside
    const policyEngine = new PolicyEngine(process.env.MOONSHOT_API_KEY || process.env.OPENAI_API_KEY);
    const sector = req.headers.get('x-agent-sector') || 'general';

    // Validate the last user message
    const lastUserMsgIndex = body.messages.findLastIndex(m => m.role === 'user');
    if (lastUserMsgIndex !== -1) {
      const userContent = body.messages[lastUserMsgIndex].content;
      // Defensive check: content can be array (multimodal), we only check string for now
      if (typeof userContent === 'string') {
        const policyResult = await policyEngine.validate({
          content: userContent,
          sector
        });

        if (!policyResult.allowed) {
          const blockReason = policyResult.violations.find(v => v.action === 'block')?.message;

          // Trigger Violation Webhook
          if (auth.kind === 'live') {
            await triggerWebhook(auth.hash, 'policy.violation', {
              rule: policyResult.violations[0].ruleId,
              reason: blockReason,
              sector
            });
          }

          return json({
            error: {
              message: `Policy Violation: ${blockReason}`,
              type: 'policy_violation',
              code: 'POLICY_BLOCK'
            }
          }, 400);
        }

        // Use sanitized content
        body.messages[lastUserMsgIndex].content = policyResult.sanitizedContent;
      }
    }
    // --- POLICY ENGINE END ---

    // Cognitive Sentinel: Inoculation
    // Find system message and append inoculation prompt to prevent jailbreaks
    const systemMessage = body.messages.find(m => m.role === 'system');
    if (systemMessage) {
      systemMessage.content = CognitiveSentinel.applyInoculation(systemMessage.content);
    } else {
      // If no system message, prepend one
      body.messages.unshift({
        role: 'system',
        content: CognitiveSentinel.applyInoculation('')
      });
    }

    // Generate cache key
    const cacheKey = await generateCacheKey(body);
    const traceId = crypto.randomUUID(); // trace ID

    const { TraceService } = await import('../../../src/lib/observability/trace-service.js');

    // Check cache
    const startTime = Date.now();
    const cached = await redis('GET', cacheKey);

    if (cached) {
      // Cache HIT
      const latency = Date.now() - startTime;
      const response = JSON.parse(cached);

      // Track metrics
      if (auth.kind === 'live') {
        // await incrementUsage(auth.hash); // TraceService does this now!
        await TraceService.record({
          traceId, type: 'hit', userId: auth.hash, model: body.model, provider: 'openai-proxy', latencyMs: 1,
          tokens: { total: 0, prompt: 0, completion: 0 }, cost: 0
        });
      }

      // Calculate cryptographic proof (SHA-256 of response body)
      const responseString = JSON.stringify(response);
      const proofBuffer = new TextEncoder().encode(responseString);
      const proofHashBuffer = await crypto.subtle.digest('SHA-256', proofBuffer);
      const proofHashArray = Array.from(new Uint8Array(proofHashBuffer));
      const proofHash = proofHashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Return cached response with OpenAI format + cache headers
      return json(response, 200, {
        'X-Cache': 'HIT',
        'X-Cache-Latency': `${latency}ms`,
        'X-AgentCache-Savings': '90%',
        'X-AgentCache-Hash': proofHash,
        'X-Trace-ID': traceId
      });
    }

    // Cache MISS - proxy to upstream provider
    let upstreamUrl = 'https://api.openai.com/v1/chat/completions';
    let upstreamKey = req.headers.get('x-openai-key');
    let provider = 'openai';

    // RouteLLM Integration
    if (body.model === 'route-llm') {
      upstreamUrl = 'https://routellm.abacus.ai/v1/chat/completions';
      upstreamKey = req.headers.get('x-abacus-key') || process.env.ABACUS_API_KEY;
      provider = 'routellm';

      if (!upstreamKey) {
        return json({
          error: 'Missing Abacus API Key',
          message: 'Include your Abacus API key as: X-Abacus-Key: ... or configure ABACUS_API_KEY env var'
        }, 400);
      }
    } else {
      // Default to OpenAI
      if (!upstreamKey) {
        return json({
          error: 'Missing X-OpenAI-Key header',
          message: 'Include your OpenAI API key as: X-OpenAI-Key: sk-...'
        }, 400);
      }
    }

    // Proxy request
    const upstreamResponse = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${upstreamKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...body,
        stream: body.stream || false
      })
    });

    if (!upstreamResponse.ok) {
      const errorData = await upstreamResponse.json();
      await TraceService.record({
        traceId, type: 'error', userId: auth.hash, model: body.model, provider, latencyMs: Date.now() - startTime,
        tokens: { total: 0, prompt: 0, completion: 0 }, cost: 0, metadata: { error: errorData }
      });
      return json({
        error: `${provider} API error`,
        details: errorData
      }, upstreamResponse.status);
    }

    // Handle Stream
    if (body.stream) {
      await TraceService.record({
        traceId, type: 'miss', userId: auth.hash, model: body.model, provider, latencyMs: Date.now() - startTime,
        tokens: { total: 0, prompt: 0, completion: 0 }, cost: 0, metadata: { stream: true }
      });
      return new Response(upstreamResponse.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Trace-ID': traceId
        }
      });
    }

    const upstreamData = await upstreamResponse.json();
    const totalLatency = Date.now() - startTime;
    const usage = upstreamData.usage || {};
    const cost = ((usage.total_tokens || 0) * 0.00003); // Placeholder pricing

    // Store in cache (7 days TTL)
    const ttl = 7 * 24 * 60 * 60; // 7 days
    await redis('SETEX', cacheKey, ttl, JSON.stringify(upstreamData));

    // Track metrics
    if (auth.kind === 'live') {
      // await incrementUsage(auth.hash);
      await TraceService.record({
        traceId,
        type: 'miss',
        userId: auth.hash,
        model: body.model,
        provider,
        latencyMs: totalLatency,
        tokens: {
          prompt: usage.prompt_tokens || 0,
          completion: usage.completion_tokens || 0,
          total: usage.total_tokens || 0
        },
        cost
      });
    }

    // Calculate cryptographic proof (SHA-256 of response body)
    const responseString = JSON.stringify(upstreamData);
    const proofBuffer = new TextEncoder().encode(responseString);
    const proofHashBuffer = await crypto.subtle.digest('SHA-256', proofBuffer);
    const proofHashArray = Array.from(new Uint8Array(proofHashBuffer));
    const proofHash = proofHashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Return response with cache headers
    return json(upstreamData, 200, {
      'X-Cache': 'MISS',
      'X-Cache-Latency': `${totalLatency}ms`,
      'X-AgentCache-Provider': provider,
      'X-AgentCache-Hash': proofHash,
      'X-Trace-ID': traceId
    });

  } catch (err) {
    console.error('Proxy error:', err);
    return json({
      error: 'Internal server error',
      details: err.message
    }, 500);
  }
}
