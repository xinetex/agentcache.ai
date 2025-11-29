import 'dotenv/config';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createHash } from 'crypto';
import { z } from 'zod';
import { redis } from './lib/redis.js';
import { ContextManager } from './infrastructure/ContextManager.js';
import vercelIntegration from './integrations/vercel.js';
import { antiCache } from './mcp/anticache.js';

const app = new Hono();
const contextManager = new ContextManager();

// Initialize Anti-Cache components
const cacheInvalidator = new antiCache.CacheInvalidator();
const urlMonitor = new antiCache.UrlMonitor();
const freshnessCalculator = antiCache.FreshnessCalculator;
const freshnessRules = new antiCache.FreshnessRuleEngine();

// Environment
const PORT = process.env.PORT || 3001;

// CORS for API routes
app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));

// Mount Vercel integration routes
app.route('/api/integrations/vercel', vercelIntegration);

// Provision API endpoints
import { provisionClient, getApiKeyInfo, provisionJettyThunder } from './api/provision-hono.js';
app.post('/api/provision', provisionClient);
app.get('/api/provision/:api_key', getApiKeyInfo);
app.post('/api/provision/jettythunder', provisionJettyThunder);

// Serve static files (landing page - defaults to community.html)
app.get('/', (c) => {
  return c.redirect('/community.html');
});
app.use('/*', serveStatic({ root: './public' }));

// Types
const CacheRequestSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'moonshot', 'cohere', 'together', 'groq']),
  model: z.string(),
  messages: z.array(z.object({
    role: z.string(),
    content: z.string(),
  })),
  temperature: z.number().optional().default(0.7),
  ttl: z.number().optional().default(604800), // 7 days
});

type CacheRequest = z.infer<typeof CacheRequestSchema>;

// Helper: Generate cache key
function generateCacheKey(req: CacheRequest): string {
  const data = {
    provider: req.provider,
    model: req.model,
    messages: req.messages,
    temperature: req.temperature,
  };
  const hash = createHash('sha256').update(JSON.stringify(data)).digest('hex');
  return `agentcache:v1:${req.provider}:${req.model}:${hash}`;
}

// Demo API keys (for MVP testing)
const DEMO_API_KEYS = new Set([
  'ac_demo_test123',
  'ac_demo_test456',
]);

// Middleware: Track usage in Redis
async function trackUsage(apiKey: string) {
  const keyHash = createHash('sha256').update(apiKey).digest('hex');
  const now = new Date();
  const monthKey = `usage:${keyHash}:m:${now.toISOString().slice(0, 7)}`;
  const quotaKey = `usage:${keyHash}:quota`;
  
  // Get quota (default 10K for community)
  const quotaStr = await redis.get(quotaKey);
  const quota = parseInt(quotaStr || '10000');
  
  // Increment usage
  const used = await redis.incr(monthKey);
  if (used === 1) {
    // First request this month - set 35 day expiry
    await redis.expire(monthKey, 3024000);
  }
  
  // Check quota
  if (used > quota) {
    return { exceeded: true, used, quota, remaining: 0 };
  }
  
  return { exceeded: false, used, quota, remaining: quota - used };
}

// Middleware: Simple API Key auth with usage tracking
async function authenticateApiKey(c: any) {
  const apiKey = c.req.header('X-API-Key') || c.req.header('Authorization')?.replace('Bearer ', '');

  if (!apiKey || !apiKey.startsWith('ac_')) {
    return c.json({
      error: 'Invalid or missing API key',
      help: 'Get your API key at https://agentcache.ai/#signup'
    }, 401);
  }

  // For MVP: Accept demo keys (unlimited usage)
  if (DEMO_API_KEYS.has(apiKey)) {
    c.set('apiKey', apiKey);
    c.set('plan', 'demo');
    c.set('usage', { used: 0, quota: 999999, remaining: 999999 });
    return null;
  }

  // Track usage for non-demo keys
  try {
    const usage = await trackUsage(apiKey);
    
    if (usage.exceeded) {
      return c.json({
        error: 'Monthly quota exceeded',
        quota: usage.quota,
        used: usage.used,
        message: 'Your free tier includes 10,000 requests/month. Upgrade for more.'
      }, 429);
    }
    
    c.set('apiKey', apiKey);
    c.set('plan', 'community');
    c.set('usage', usage);
    return null;
  } catch (error: any) {
    console.error('[Usage] Tracking error:', error);
    // Allow request on tracking error (fail open)
    c.set('apiKey', apiKey);
    c.set('plan', 'community');
    return null;
  }
}

/**
 * GET /api/health
 */
app.get('/api/health', (c) => {
  return c.json({
    status: 'healthy',
    service: 'AgentCache.ai',
    version: '1.0.0-mvp',
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /api/cache/check - Check if response is cached
 */
app.post('/api/cache/check', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const body = await c.req.json();
    const req = CacheRequestSchema.parse(body);
    const key = generateCacheKey(req);

    const exists = await redis.exists(key);
    const ttl = exists ? await redis.ttl(key) : 0;

    return c.json({
      cached: exists === 1,
      key: key.slice(-16),
      ttl,
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

/**
 * POST /api/cache/get - Retrieve cached response
 */
app.post('/api/cache/get', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const body = await c.req.json();
    const req = CacheRequestSchema.parse(body);
    const key = generateCacheKey(req);

    const startTime = Date.now();
    const cached = await redis.get(key);
    const latency = Date.now() - startTime;

    if (!cached) {
      return c.json({
        hit: false,
        message: 'Cache miss - call your LLM provider',
      }, 404);
    }

    // Get freshness metadata
    const metaKey = `${key}:meta`;
    const metaData = await redis.get(metaKey);
    let freshness = null;

    if (metaData) {
      try {
        const metadata = JSON.parse(metaData);
        cacheInvalidator.recordAccess(key);
        const freshnessStatus = freshnessCalculator.calculateFreshness(metadata);
        freshness = {
          status: freshnessStatus.status,
          age: freshnessStatus.age,
          freshnessScore: freshnessStatus.freshnessScore,
          shouldRefresh: freshnessStatus.shouldRefresh
        };
      } catch (e) {
        // Metadata parse error, ignore
      }
    }

    return c.json({
      hit: true,
      response: cached,
      latency,
      saved: '~$0.01-$1.00',
      freshness
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

/**
 * POST /api/cache/set - Store AI response in cache
 */
app.post('/api/cache/set', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const body = await c.req.json();
    const req = CacheRequestSchema.parse(body);
    const response = body.response;

    if (!response) {
      return c.json({ error: 'response field required' }, 400);
    }

    const key = generateCacheKey(req);
    await redis.setex(key, req.ttl, response);

    // Store freshness metadata
    const metadata = {
      cachedAt: Date.now(),
      ttl: req.ttl * 1000, // Convert seconds to ms
      namespace: body.namespace || 'default',
      sourceUrl: body.sourceUrl,
      accessCount: 0,
      lastAccessed: Date.now()
    };

    const metaKey = `${key}:meta`;
    await redis.setex(metaKey, req.ttl, JSON.stringify(metadata));

    // Register with invalidator
    cacheInvalidator.registerCache(key, metadata);

    return c.json({
      success: true,
      key: key.slice(-16),
      ttl: req.ttl,
      message: 'Response cached successfully',
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

/**
 * POST /api/agent/chat - Stateful Agent Chat with Virtual Memory + Reasoning Cache
 */
app.post('/api/agent/chat', async (c) => {
  const apiKey = c.req.header('X-API-Key');
  if (!apiKey) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const { sessionId, message, freshness } = await c.req.json();

    if (!sessionId || !message) {
      return c.json({ error: 'Missing sessionId or message' }, 400);
    }

    // 1. Get Context (with optional Freshness Bypass)
    const context = await contextManager.getContext(sessionId, message, { freshness });

    // 2. Build messages for LLM
    const llmMessages = [
      ...context.messages.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content
      })),
      {
        role: 'user' as const,
        content: message
      }
    ];

    // 3. Call Moonshot AI (with reasoning token caching)
    // If MOONSHOT_API_KEY is not set, we'll fall back to local simulation
    let aiResponse: string;
    let reasoningMetadata = {};

    if (process.env.MOONSHOT_API_KEY) {
      try {
        const { MoonshotClient } = await import('./lib/moonshot.js');
        const client = new MoonshotClient(process.env.MOONSHOT_API_KEY);

        const moonshotResponse = await client.chat(llmMessages as any, 'moonshot-v1-128k', 0.7);

        aiResponse = moonshotResponse.choices[0].message.content;
        reasoningMetadata = {
          reasoningTokens: moonshotResponse.usage.reasoning_tokens || 0,
          cacheHit: false, // Client doesn't expose this yet, would need header inspection
          model: moonshotResponse.model
        };
      } catch (error: any) {
        console.error('[Moonshot] API call failed, falling back to simulation:', error.message);
        aiResponse = `[Simulated AI Response to: "${message}"]`;
      }
    } else {
      // Fallback: Simulated response if Moonshot key not configured
      aiResponse = `[Simulated AI Response to: "${message}"]`;
    }

    // 4. Save Interaction (Write-Through with reasoning metadata)
    await contextManager.saveInteraction(sessionId, message, aiResponse, reasoningMetadata);

    return c.json({
      sessionId,
      response: aiResponse,
      contextSource: context.source,
      virtualMemorySize: context.messages.length,
      metadata: reasoningMetadata
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Anti-Cache: Pruning Endpoint
app.delete('/api/agent/memory', async (c) => {
  const apiKey = c.req.header('X-API-Key');
  if (!apiKey) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const id = c.req.query('id');
    if (!id) return c.json({ error: 'Missing memory ID' }, 400);

    await contextManager.deleteMemory(id);

    return c.json({ success: true, message: `Memory ${id} pruned.` });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

/**
 * POST /api/cache/invalidate - Invalidate caches by pattern, namespace, age, or URL
 * Anti-Cache feature: Actively remove stale caches
 */
app.post('/api/cache/invalidate', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const body = await c.req.json();
    const { pattern, namespace, olderThan, url, reason, notify, preWarm } = body;

    // Validate at least one invalidation criterion
    if (!pattern && !namespace && !olderThan && !url) {
      return c.json({
        error: 'Must provide at least one invalidation criterion',
        criteria: ['pattern', 'namespace', 'olderThan', 'url']
      }, 400);
    }

    // Perform invalidation
    const result = await cacheInvalidator.invalidate({
      pattern,
      namespace,
      olderThan,
      url,
      reason,
      notify,
      preWarm
    });

    return c.json({
      success: true,
      ...result,
      reason: reason || 'manual_invalidation',
      timestamp: Date.now()
    });
  } catch (error: any) {
    console.error('[Anti-Cache] Invalidation error:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * POST /api/listeners/register - Register URL for monitoring & auto-invalidation
 */
app.post('/api/listeners/register', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const body = await c.req.json();
    const { url, checkInterval = 900000, namespace = 'default', invalidateOnChange = true, webhook } = body;

    if (!url) {
      return c.json({ error: 'URL is required' }, 400);
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return c.json({ error: 'Invalid URL format' }, 400);
    }

    // Minimum interval: 15 minutes (900000ms)
    if (checkInterval < 900000) {
      return c.json({ error: 'Check interval must be at least 15 minutes (900000ms)' }, 400);
    }

    // Register listener
    const listenerId = urlMonitor.registerListener({
      url,
      checkInterval,
      namespace,
      invalidateOnChange,
      webhook,
      enabled: true
    });

    const listener = urlMonitor.getListener(listenerId);

    return c.json({
      success: true,
      listenerId,
      url,
      checkInterval,
      namespace,
      initialHash: listener?.lastHash || '',
      message: 'Listener registered successfully. First check will run in background.'
    }, 201);
  } catch (error: any) {
    console.error('[Anti-Cache] Listener registration error:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * GET /api/listeners - List all active URL listeners
 */
app.get('/api/listeners', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const listeners = urlMonitor.getAllListeners();

    return c.json({
      listeners: listeners.map(l => ({
        id: l.id,
        url: l.url,
        checkInterval: l.checkInterval,
        lastCheck: l.lastCheck,
        lastHash: l.lastHash.substring(0, 8),
        namespace: l.namespace,
        invalidateOnChange: l.invalidateOnChange,
        webhook: l.webhook,
        enabled: l.enabled
      })),
      count: listeners.length
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

/**
 * DELETE /api/listeners - Unregister URL listener
 */
app.delete('/api/listeners', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const id = c.req.query('id');
    if (!id) {
      return c.json({ error: 'Listener ID is required' }, 400);
    }

    const success = urlMonitor.unregisterListener(id);
    
    if (!success) {
      return c.json({ error: 'Listener not found' }, 404);
    }

    return c.json({
      success: true,
      message: 'Listener unregistered successfully'
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

/**
 * GET /api/stats - Usage statistics
 */
app.get('/api/stats', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  const usage = c.get('usage') || { used: 0, quota: 10000, remaining: 10000 };
  const plan = c.get('plan') || 'community';

  return c.json({
    plan,
    monthlyQuota: usage.quota,
    used: usage.used,
    remaining: usage.remaining,
    percentUsed: Math.round((usage.used / usage.quota) * 100),
    resetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
  });
});

/**
 * POST /api/auth/signup - Coming soon
 */
app.post('/api/auth/signup', async (c) => {
  const body = await c.req.json();
  const { email } = body;

  // Store in Redis for waitlist
  if (email) {
    await redis.sadd('waitlist', email);
  }

  return c.json({
    success: true,
    message: 'Thanks for your interest! We\'ll email you when auth is ready.',
    demoKey: 'ac_demo_test123',
    note: 'Use this demo key to test the API now',
  });
});

/**
 * POST /api/edges/optimal - Get optimal edge locations for file upload
 */
app.post('/api/edges/optimal', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const body = await c.req.json();
    const { lat, lng, fileSize, priority = 'balanced', topN = 5 } = body;

    if (!lat || !lng) {
      return c.json({ error: 'Missing lat/lng' }, 400);
    }

    // Import edge selector
    const { edgeSelector } = await import('./services/edgeSelector.js');
    const { jettySpeedDb } = await import('./services/jettySpeedDb.js');

    // Get active edges
    const edges = await jettySpeedDb.getActiveEdges();
    
    // Get edge metrics (or use mock data)
    const metrics = await jettySpeedDb.getAllEdgeMetrics();

    // Select optimal edges
    const selectedEdges = edgeSelector.selectOptimalEdges(
      edges,
      metrics,
      { lat, lng },
      priority as 'speed' | 'cost' | 'balanced',
      topN
    );

    return c.json({
      edges: selectedEdges,
      fileSize,
      priority,
    });
  } catch (error: any) {
    console.error('Edge selection error:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * POST /api/jetty-speed/chunk - Upload chunk through edge (proxy to Lyve)
 */
app.post('/api/jetty-speed/chunk', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const fileId = c.req.header('X-File-Id');
    const chunkIndex = c.req.header('X-Chunk-Index');
    const lyveUploadUrl = c.req.header('X-Lyve-Upload-Url');
    const edgeId = c.req.header('X-Edge-Id');

    if (!fileId || !chunkIndex || !lyveUploadUrl) {
      return c.json({ error: 'Missing required headers' }, 400);
    }

    // Read chunk data
    const chunkData = await c.req.arrayBuffer();

    // Cache chunk in Redis (base64 encoded)
    const cacheKey = `chunk:${fileId}:${chunkIndex}`;
    const base64Chunk = Buffer.from(chunkData).toString('base64');
    await redis.setex(cacheKey, 3600, base64Chunk); // 1 hour TTL

    // Stream to Lyve Cloud
    const lyveResponse = await fetch(lyveUploadUrl, {
      method: 'PUT',
      body: chunkData,
    });

    if (!lyveResponse.ok) {
      throw new Error(`Lyve upload failed: ${lyveResponse.status}`);
    }

    const etag = lyveResponse.headers.get('ETag');

    return c.json({
      success: true,
      chunkIndex: parseInt(chunkIndex),
      etag,
      edgeId,
      cached: true,
    });
  } catch (error: any) {
    console.error('Chunk upload error:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * GET /api/jetty-speed/chunk/:fileId/:chunkIndex - Download cached chunk
 */
app.get('/api/jetty-speed/chunk/:fileId/:chunkIndex', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const { fileId, chunkIndex } = c.req.param();
    const lyveDownloadUrl = c.req.header('X-Lyve-Download-Url');

    // Check cache first
    const cacheKey = `chunk:${fileId}:${chunkIndex}`;
    const startTime = Date.now();
    const cached = await redis.get(cacheKey);

    if (cached) {
      // Cache hit!
      const latency = Date.now() - startTime;
      const chunkBuffer = Buffer.from(cached, 'base64');
      
      return new Response(chunkBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Cache': 'HIT',
          'X-Cache-Latency': latency.toString(),
        },
      });
    }

    // Cache miss - fetch from Lyve if URL provided
    if (lyveDownloadUrl) {
      const lyveResponse = await fetch(lyveDownloadUrl);
      
      if (!lyveResponse.ok) {
        return c.json({ error: 'Failed to fetch from Lyve' }, 502);
      }

      const chunkData = await lyveResponse.arrayBuffer();
      const chunkBuffer = Buffer.from(chunkData);

      // Cache for next time (24 hour TTL for downloads)
      const base64Chunk = chunkBuffer.toString('base64');
      await redis.setex(cacheKey, 86400, base64Chunk);

      return new Response(chunkBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Cache': 'MISS',
        },
      });
    }

    // No cache and no Lyve URL provided
    return c.json({ error: 'Chunk not found in cache' }, 404);
  } catch (error: any) {
    console.error('Chunk download error:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * POST /api/overflow - Elastic Overflow API for partners (Redis, AWS, Vector DBs)
 * Partners use AgentCache as fallback/overflow layer
 */
app.post('/api/overflow', async (c) => {
  try {
    // Get partner credentials from headers
    const partnerId = c.req.header('x-partner-id');
    const partnerKey = c.req.header('x-partner-key');

    if (!partnerId || !partnerKey) {
      return c.json({ error: 'Missing partner credentials' }, 401);
    }

    // Hardcoded partners (MVP)
    const PARTNERS: Record<string, { name: string; split: number; active: boolean }> = {
      'redis-labs': { name: 'Redis Labs', split: 0.30, active: true },
      'pinecone': { name: 'Pinecone', split: 0.20, active: true },
      'together-ai': { name: 'Together.ai', split: 0.20, active: true },
    };

    const partner = PARTNERS[partnerId];
    if (!partner || !partner.active) {
      return c.json({ error: 'Invalid or inactive partner' }, 401);
    }

    // Parse request body
    const body = await c.req.json();
    const { customer_id, original_request, action, response: partnerResponse } = body;

    if (!customer_id || !original_request) {
      return c.json({ error: 'Missing customer_id or original_request' }, 400);
    }

    // Generate cache key
    const cacheData = {
      provider: original_request.provider,
      model: original_request.model,
      messages: original_request.messages,
      temperature: original_request.temperature || 0.7
    };
    const hash = createHash('sha256').update(JSON.stringify(cacheData)).digest('hex');
    const cacheKey = `agentcache:v1:overflow:${original_request.provider}:${original_request.model}:${hash}`;

    const startTime = Date.now();

    // Handle SET action (partner storing in our cache)
    if (action === 'set') {
      if (!partnerResponse) {
        return c.json({ error: 'Missing response for set action' }, 400);
      }

      await redis.setex(cacheKey, 604800, JSON.stringify(partnerResponse)); // 7 days
      await redis.hincrby(`partner:${partnerId}:stats`, 'sets', 1);

      return c.json({
        success: true,
        action: 'set',
        partner: partner.name,
        latency: Date.now() - startTime
      });
    }

    // Default: GET action (partner checking our cache)
    const cached = await redis.get(cacheKey);
    const latency = Date.now() - startTime;

    if (cached) {
      // Cache HIT - partner gets response from us
      await Promise.all([
        redis.hincrby(`partner:${partnerId}:stats`, 'hits', 1),
        redis.hincrby(`partner:${partnerId}:customer:${customer_id}`, 'hits', 1)
      ]);

      // Estimate cost saved and revenue share
      const costSaved = 0.01; // $0.01 average per request
      const partnerRevenue = costSaved * partner.split;

      return c.json({
        hit: true,
        response: JSON.parse(cached),
        latency,
        source: 'agentcache-overflow',
        billing: {
          cost_saved: costSaved,
          partner_revenue: partnerRevenue,
          revenue_split: partner.split
        }
      });
    } else {
      // Cache MISS
      await redis.hincrby(`partner:${partnerId}:stats`, 'misses', 1);

      return c.json({
        hit: false,
        latency,
        message: 'Cache miss - partner should call set action after LLM response'
      }, 404);
    }
  } catch (error: any) {
    console.error('[Overflow API] Error:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * GET /api/overflow/partners - List active overflow partners
 */
app.get('/api/overflow/partners', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const partners = [
      { id: 'redis-labs', name: 'Redis Labs', split: 0.30, active: true },
      { id: 'pinecone', name: 'Pinecone', split: 0.20, active: true },
      { id: 'together-ai', name: 'Together.ai', split: 0.20, active: true },
    ];

    // Get stats for each partner
    const partnersWithStats = await Promise.all(
      partners.map(async (p) => {
        const stats = await redis.hgetall(`partner:${p.id}:stats`);
        return {
          ...p,
          stats: {
            hits: parseInt(stats.hits || '0'),
            misses: parseInt(stats.misses || '0'),
            sets: parseInt(stats.sets || '0')
          }
        };
      })
    );

    return c.json({ partners: partnersWithStats });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

/**
 * GET /api/overflow/stats - Detailed overflow partner statistics
 */
app.get('/api/overflow/stats', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  try {
    const partners = ['redis-labs', 'pinecone', 'together-ai'];
    
    const stats = await Promise.all(
      partners.map(async (partnerId) => {
        const [cacheStats, webhookStats] = await Promise.all([
          redis.hgetall(`partner:${partnerId}:stats`),
          redis.hgetall(`partner:${partnerId}:webhooks`)
        ]);
        
        const hits = parseInt(cacheStats.hits || '0');
        const misses = parseInt(cacheStats.misses || '0');
        const sets = parseInt(cacheStats.sets || '0');
        const totalRequests = hits + misses;
        
        const webhookSuccess = parseInt(webhookStats.success || '0');
        const webhookFailure = parseInt(webhookStats.failure || '0');
        const totalWebhooks = webhookSuccess + webhookFailure;
        
        return {
          id: partnerId,
          cache: {
            hits,
            misses,
            sets,
            total: totalRequests,
            hitRate: totalRequests > 0 ? (hits / totalRequests * 100).toFixed(1) : '0.0'
          },
          webhooks: {
            success: webhookSuccess,
            failure: webhookFailure,
            total: totalWebhooks,
            successRate: totalWebhooks > 0 ? (webhookSuccess / totalWebhooks * 100).toFixed(1) : '0.0'
          },
          revenue: {
            estimated: (hits * 0.01 * 0.25).toFixed(2) // Rough estimate
          }
        };
      })
    );
    
    return c.json({ 
      partners: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[Overflow Stats] Error:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * GET /api - API info
 */
app.get('/api', (c) => {
  return c.json({
    service: 'AgentCache.ai',
    tagline: 'Edge caching for AI responses - Save 90% on LLM costs',
    version: '1.0.0-mvp',
    status: 'beta',
    demoKey: 'ac_demo_test123',
    docs: 'https://agentcache.ai/docs',
    endpoints: {
      '/api/health': 'Health check',
      '/api/auth/signup': 'Join waitlist (get demo key)',
      '/api/cache/check': 'Check if response is cached',
      '/api/cache/get': 'Get cached response',
      '/api/cache/set': 'Store response in cache',
      '/api/cache/invalidate': 'Invalidate caches (Anti-Cache)',
      '/api/listeners/register': 'Register URL monitoring (Anti-Cache)',
      '/api/overflow': 'Elastic overflow for partners',
      '/api/stats': 'Usage statistics',
      '/api/edges/optimal': 'Get optimal edge locations (JettySpeed)',
      '/api/jetty-speed/chunk': 'Upload chunk via edge (JettySpeed)',
      '/api/jetty-speed/chunk/:fileId/:chunkIndex': 'Download cached chunk (JettySpeed)',
    },
  });
});

// Start server
console.log(`🚀 AgentCache.ai MVP starting on port ${PORT}`);
console.log(`🎯 Demo API Key: ac_demo_test123`);
serve({
  fetch: app.fetch,
  port: Number(PORT),
});
