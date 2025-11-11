import 'dotenv/config';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import Redis from 'ioredis';
import { createHash } from 'crypto';
import { z } from 'zod';
import Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { db, users, apiKeys, usageLogs } from './db/index.js';
import { 
  hashPassword, 
  verifyPassword, 
  generateToken, 
  verifyToken, 
  generateApiKey,
  hashApiKey,
  verifyApiKey,
  type JWTPayload 
} from './lib/auth.js';

const app = new Hono();

// Environment
const PORT = process.env.PORT || 3001;
const REDIS_URL = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY!;

if (!REDIS_URL) {
  console.error('❌ REDIS_URL not configured');
  process.exit(1);
}

// Redis client
const redis = new (Redis as any)(REDIS_URL);
redis.on('connect', () => console.log('✅ Redis connected'));
redis.on('error', (err: Error) => console.error('❌ Redis error:', err));

// Stripe client
const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2025-08-27.basil' as any });

// CORS for API routes
app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));

// Serve static files (landing page)
app.use('/*', serveStatic({ root: './public' }));

// Types
const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

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

// Middleware: API Key auth
async function authenticateApiKey(c: any) {
  if (!db) {
    return c.json({ error: 'Database not configured' }, 500);
  }

  const apiKey = c.req.header('X-API-Key') || c.req.header('Authorization')?.replace('Bearer ', '');
  
  if (!apiKey || !apiKey.startsWith('ac_')) {
    return c.json({ error: 'Invalid or missing API key' }, 401);
  }

  try {
    // Find API key in database
    const allKeys = await db.select().from(apiKeys).where(eq(apiKeys.isActive, true));
    
    for (const keyRecord of allKeys) {
      const isValid = await verifyApiKey(apiKey, keyRecord.key);
      if (isValid) {
        // Get user
        const [user] = await db.select().from(users).where(eq(users.id, keyRecord.userId));
        
        if (!user) {
          return c.json({ error: 'User not found' }, 404);
        }

        // Check quota
        if (user.usedThisMonth >= user.monthlyQuota) {
          return c.json({ 
            error: 'Monthly quota exceeded',
            used: user.usedThisMonth,
            quota: user.monthlyQuota,
            upgradeUrl: 'https://agentcache.ai/#pricing'
          }, 429);
        }

        c.set('user', user);
        c.set('apiKeyId', keyRecord.id);
        return null;
      }
    }
    
    return c.json({ error: 'Invalid API key' }, 401);
  } catch (error: any) {
    console.error('Auth error:', error);
    return c.json({ error: 'Authentication failed' }, 500);
  }
}

// Middleware: JWT auth
async function authenticateJWT(c: any) {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return c.json({ error: 'Missing authorization token' }, 401);
  }

  const payload = verifyToken(token);
  
  if (!payload) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  c.set('userId', payload.userId);
  c.set('email', payload.email);
  return null;
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
 * POST /api/auth/signup - Create new user account
 */
app.post('/api/auth/signup', async (c) => {
  if (!db) {
    return c.json({ error: 'Database not configured' }, 500);
  }

  try {
    const body = await c.req.json();
    const { email, password, name } = SignupSchema.parse(body);

    // Check if user exists
    const [existing] = await db.select().from(users).where(eq(users.email, email));
    if (existing) {
      return c.json({ error: 'Email already registered' }, 400);
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const [user] = await db.insert(users).values({
      email,
      password: hashedPassword,
      name,
      plan: 'free',
      monthlyQuota: 1000,
      usedThisMonth: 0,
    }).returning();

    // Generate API key
    const apiKey = generateApiKey('live');
    const hashedKey = await hashApiKey(apiKey);

    await db.insert(apiKeys).values({
      userId: user.id,
      key: hashedKey,
      name: 'Default API Key',
      isActive: true,
    });

    // Generate JWT
    const token = generateToken({ userId: user.id, email: user.email });

    return c.json({
      success: true,
      token,
      apiKey, // Show once, never again
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        quota: user.monthlyQuota,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid input', details: error.errors }, 400);
    }
    console.error('Signup error:', error);
    return c.json({ error: 'Signup failed' }, 500);
  }
});

/**
 * POST /api/auth/login - User login
 */
app.post('/api/auth/login', async (c) => {
  if (!db) {
    return c.json({ error: 'Database not configured' }, 500);
  }

  try {
    const body = await c.req.json();
    const { email, password } = LoginSchema.parse(body);

    // Find user
    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Generate JWT
    const token = generateToken({ userId: user.id, email: user.email });

    return c.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        quota: user.monthlyQuota,
        used: user.usedThisMonth,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid input' }, 400);
    }
    console.error('Login error:', error);
    return c.json({ error: 'Login failed' }, 500);
  }
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

  const user: any = c.get('user');
  const apiKeyId: string = c.get('apiKeyId');

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
    
    // Log cache hit
    if (db) {
      await db.insert(usageLogs).values({
        userId: user.id,
        apiKeyId,
        provider: req.provider,
        model: req.model,
        cacheHit: true,
        latencyMs: latency,
        savedCost: 1, // Estimate: $0.01 saved
      });
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

  const user: any = c.get('user');
  const apiKeyId: string = c.get('apiKeyId');

  try {
    const body = await c.req.json();
    const req = CacheRequestSchema.parse(body);
    const response = body.response;
    
    if (!response) {
      return c.json({ error: 'response field required' }, 400);
    }
    
    const key = generateCacheKey(req);
    await redis.setex(key, req.ttl, response);
    
    // Increment usage counter
    if (db) {
      await db.update(users)
        .set({ usedThisMonth: user.usedThisMonth + 1 })
        .where(eq(users.id, user.id));

      // Log cache miss
      await db.insert(usageLogs).values({
        userId: user.id,
        apiKeyId,
        provider: req.provider,
        model: req.model,
        cacheHit: false,
        estimatedCost: 1, // $0.01 estimate
      });
    }
    
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
 * GET /api/stats - User's cache statistics
 */
app.get('/api/stats', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  const user: any = c.get('user');

  return c.json({
    plan: user.plan,
    monthlyQuota: user.monthlyQuota,
    used: user.usedThisMonth,
    remaining: user.monthlyQuota - user.usedThisMonth,
    email: user.email,
  });
});

/**
 * POST /api/checkout - Create Stripe checkout session
 */
app.post('/api/checkout', async (c) => {
  const authError = await authenticateJWT(c);
  if (authError) return authError;

  try {
    const { priceId } = await c.req.json();
    const userId = c.get('userId');

    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Create or get Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await db.update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, userId));
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: 'https://agentcache.ai/dashboard?success=true',
      cancel_url: 'https://agentcache.ai/#pricing',
      metadata: { userId: user.id },
    });

    return c.json({ url: session.url });
  } catch (error: any) {
    console.error('Checkout error:', error);
    return c.json({ error: 'Failed to create checkout session' }, 500);
  }
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
      '/api/auth/signup': 'Create account',
      '/api/auth/login': 'User login',
      '/api/cache/check': 'Check if response is cached',
      '/api/cache/get': 'Get cached response',
      '/api/cache/set': 'Store response in cache',
      '/api/stats': 'User statistics',
      '/api/checkout': 'Create Stripe checkout',
    },
  });
});

// Start server
console.log(`🚀 AgentCache.ai starting on port ${PORT}`);
console.log(`📊 Database: ${db ? 'Connected' : 'Not configured'}`);
serve({
  fetch: app.fetch,
  port: Number(PORT),
});
