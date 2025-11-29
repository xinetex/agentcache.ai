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

const app = new Hono();
const contextManager = new ContextManager();

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

// Middleware: Simple API Key auth
async function authenticateApiKey(c: any) {
  const apiKey = c.req.header('X-API-Key') || c.req.header('Authorization')?.replace('Bearer ', '');

  if (!apiKey || !apiKey.startsWith('ac_')) {
    return c.json({
      error: 'Invalid or missing API key',
      help: 'Get your API key at https://agentcache.ai/#signup'
    }, 401);
  }

  // For MVP: Accept demo keys
  if (DEMO_API_KEYS.has(apiKey)) {
    c.set('apiKey', apiKey);
    c.set('plan', 'demo');
    return null;
  }

  return c.json({
    error: 'Invalid API key. Sign up at https://agentcache.ai',
  }, 401);
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

    return c.json({
      hit: true,
      response: cached,
      latency,
      saved: '~$0.01-$1.00',
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
 * GET /api/stats - Demo stats
 */
app.get('/api/stats', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  return c.json({
    plan: 'demo',
    monthlyQuota: 1000,
    used: 42,
    remaining: 958,
    message: 'MVP Demo - Full auth coming soon!',
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
