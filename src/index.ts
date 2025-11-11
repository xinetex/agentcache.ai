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
const PORT = process.env.PORT || 3001;
const REDIS_URL = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;

if (!REDIS_URL) {
  console.error('❌ REDIS_URL not configured');
  process.exit(1);
}

// Redis client
const redis = new (Redis as any)(REDIS_URL);
redis.on('connect', () => console.log('✅ Redis connected'));
redis.on('error', (err: Error) => console.error('❌ Redis error:', err));

// CORS for API routes
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
