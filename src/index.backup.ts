import 'dotenv/config';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import Redis from 'ioredis';
import { createHash } from 'crypto';
import { z } from 'zod';

const app = new Hono();

// Environment
const PORT = process.env.PORT || 8787;
const REDIS_URL = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;

if (!REDIS_URL) {
  console.error('❌ REDIS_URL not configured');
  process.exit(1);
}

// Redis client
const redis = new Redis(REDIS_URL);

redis.on('connect', () => console.log('✅ Redis connected'));
redis.on('error', (err) => console.error('❌ Redis error:', err));

// CORS for all origins (customize for production)
app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));

// Serve static files (landing page)
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

// Middleware: API Key auth (simplified for now)
async function authenticate(c: any) {
  const apiKey = c.req.header('X-API-Key') || c.req.header('Authorization')?.replace('Bearer ', '');
  
  if (!apiKey || !apiKey.startsWith('ac_')) {
    return c.json({ error: 'Invalid or missing API key' }, 401);
  }
  
  // TODO: Validate against database and check quota
  c.set('apiKey', apiKey);
  c.set('userId', 'demo-user'); // Replace with DB lookup
}

/**
 * Health check
 */
app.get('/api/health', (c) => {
  return c.json({ 
    status: 'healthy', 
    service: 'AgentCache.ai',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /cache - Check if a response is cached
 */
app.post('/api/cache/check', async (c) => {
  const auth = await authenticate(c);
  if (auth) return auth;

  try {
    const body = await c.req.json();
    const req = CacheRequestSchema.parse(body);
    const key = generateCacheKey(req);
    
    const exists = await redis.exists(key);
    const ttl = exists ? await redis.ttl(key) : 0;
    
    return c.json({ 
      cached: exists === 1,
      key: key.slice(-16), // Last 16 chars for debugging
      ttl,
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

/**
 * POST /cache/get - Retrieve cached response
 */
app.post('/api/cache/get', async (c) => {
  const auth = await authenticate(c);
  if (auth) return auth;

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
    
    // TODO: Log usage (cache hit)
    
    return c.json({
      hit: true,
      response: cached,
      latency,
      saved: '~$0.01-$1.00', // Estimate based on model
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

/**
 * POST /cache/set - Store AI response in cache
 */
app.post('/api/cache/set', async (c) => {
  const auth = await authenticate(c);
  if (auth) return auth;

  try {
    const body = await c.req.json();
    const req = CacheRequestSchema.parse(body);
    const response = body.response;
    
    if (!response) {
      return c.json({ error: 'response field required' }, 400);
    }
    
    const key = generateCacheKey(req);
    await redis.setex(key, req.ttl, response);
    
    // TODO: Log usage (cache miss)
    
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
 * GET /stats - User's cache statistics
 */
app.get('/api/stats', async (c) => {
  const auth = await authenticate(c);
  if (auth) return auth;

  // TODO: Fetch from database
  return c.json({
    plan: 'free',
    monthlyQuota: 1000,
    used: 234,
    remaining: 766,
    cacheHitRate: 87.5,
    estimatedSavings: '$12.40',
    topProvider: 'openai',
  });
});

/**
 * POST /api-keys - Generate new API key (requires auth)
 */
app.post('/api/api-keys', async (c) => {
  // TODO: Implement user authentication and API key generation
  const { nanoid } = await import('nanoid');
  const key = `ac_live_${nanoid(32)}`;
  
  return c.json({
    key,
    name: 'My API Key',
    createdAt: new Date().toISOString(),
  });
});

/**
 * API info endpoint
 */
app.get('/api', (c) => {
  return c.json({
    service: 'AgentCache.ai',
    tagline: 'Edge caching for AI responses - Save 90% on LLM costs',
    version: '1.0.0',
    docs: 'https://agentcache.ai/docs',
    endpoints: {
      '/api/health': 'Health check',
      '/api/cache/check': 'Check if response is cached',
      '/api/cache/get': 'Get cached response',
      '/api/cache/set': 'Store response in cache',
      '/api/stats': 'User statistics',
      '/api/api-keys': 'Manage API keys',
    },
  });
});

// Start server
console.log(`🚀 AgentCache.ai starting on port ${PORT}`);
serve({
  fetch: app.fetch,
  port: Number(PORT),
});
