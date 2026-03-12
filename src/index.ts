/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
import 'dotenv/config';
// -----------------------------------------------------------------------------
// Security Middleware (Armor) - imported here, applied after app creation below
// -----------------------------------------------------------------------------
import { ArmorService } from './services/ArmorService.js';
const armor = new ArmorService();

// import { serve } from '@hono/node-server'; // Moved to src/server.ts
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createHash } from 'crypto';
import { z } from 'zod';
import { redis } from './lib/redis.js';
import { autonomyService } from './services/AutonomyService.js';
import { ContextManager } from './infrastructure/ContextManager.js';
// import vercelIntegration from './integrations/vercel.js'; // Lazy loaded below
import { antiCache, CacheInvalidator, UrlMonitor, FreshnessCalculator, FreshnessRuleEngine } from './mcp/anticache.js';
import { getTierQuota, getTierFeatures, getAllTiers } from './config/tiers.js';
import { canUseNamespace, isTTLAllowed, getFeatureLimit } from './lib/tierChecker.js';
import { stableStringify, stableHash } from './lib/stable-json.js';
import { generateEmbedding } from './lib/llm/embeddings.js';
import { upsertMemory, queryMemory } from './lib/vector.js';
import { savingsTracker } from './lib/llm/savings-tracker.js';
import { tokenBudget } from './lib/llm/token-budget.js';
import * as bcrypt from 'bcryptjs';
import { neon } from '@neondatabase/serverless';

// Environment & Safety Checks
const safeEnv = (key: string) => process.env[key] || '';

// Initialize Neon (Fail gracefully)
let sql: any;
try {
  if (process.env.DATABASE_URL) {
    sql = neon(process.env.DATABASE_URL);
  } else {
    console.warn('[Startup] DATABASE_URL missing - Neon client disabled');
  }
} catch (e) {
  console.warn('[Startup] Neon init failed:', e);
}

// Type definitions for Hono variables
type Variables = {
  tier: string;
  usage: any;
  tierFeatures: any;
};

export const app = new Hono<{ Variables: Variables }>();

// -----------------------------------------------------------------------------
// Armor WAF Middleware (must be registered after app creation)
// -----------------------------------------------------------------------------
app.use('/api/*', async (c, next) => {
  const ip = c.req.header('x-forwarded-for') || '127.0.0.1';

  // Parse body for WAF if method is POST/PUT
  let payload = undefined;
  if (['POST', 'PUT'].includes(c.req.method)) {
    try {
      payload = await c.req.json().catch(() => ({}));
    } catch (e) { }
  }

  const check = await armor.checkRequest(ip, c.req.path, payload);

  if (!check.allowed) {
    return c.json({ error: `Firewall Blocked: ${check.reason}` }, check.reason.includes('Rate') ? 429 : 403);
  }

  await next();
});

// -----------------------------------------------------------------------------
// Coherence Telemetry Middleware (Phase 4.1)
// -----------------------------------------------------------------------------
app.use('/api/*', async (c, next) => {
  await next();

  const swarmId = c.req.header('X-Swarm-Id') || 'global-swarm';
  try {
    const healthRaw = await redis.get(`swarm:health:${swarmId}`);
    if (healthRaw) {
      const health = typeof healthRaw === 'string' ? JSON.parse(healthRaw) : healthRaw;
      c.header('X-Swarm-Coherence', (1 - (health.divergenceScore || 0)).toFixed(4));
      c.header('X-Byzantine-Status', health.status || 'healthy');
      if (health.intuitionDrift) {
        c.header('X-Intuition-Drift', 'true');
      }
    }
  } catch (e) {
    // Fail silently to avoid breaking the main request flow
  }
});
// Lazy load ContextManager
let contextManager: ContextManager | null = null;
function getContextManager() {
  if (!contextManager) contextManager = new ContextManager();
  return contextManager;
}

// Initialize Anti-Cache components (Lazy)
let cacheInvalidator: CacheInvalidator | null = null;
function getCacheInvalidator() {
  if (!cacheInvalidator) cacheInvalidator = new CacheInvalidator();
  return cacheInvalidator;
}

let urlMonitor: UrlMonitor | null = null;
function getUrlMonitor() {
  if (!urlMonitor) urlMonitor = new UrlMonitor();
  return urlMonitor;
}

const freshnessCalculator = FreshnessCalculator;
const freshnessRules = new FreshnessRuleEngine();

// Initialize Autonomic Pattern Engine (The "Will")
// Wrapped to prevent server crash if DB/Redis is down
(async () => {
  try {
    if (process.env.DATABASE_URL && (process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL) && !process.env.VERCEL) {
      // Dynamic import to prevent heavy load on Vercel startup
      const { PatternEngine } = await import('./infrastructure/PatternEngine.js');
      const patternEngine = new PatternEngine();
      // Only listen if not in serverless ephemeral mode and not in test
      if (process.env.NODE_ENV !== 'test') {
        patternEngine.listen();
      }
    } else {
      // Start Autonomy Engine (Phase 5)
      if (process.env.NODE_ENV !== 'test') {
        autonomyService.start();
        console.log('[Startup] Autonomy Engine: ACTIVE');

        // Phase 4.2: Register initial Maintenance Watchers
        const { invalidationService } = await import('./services/InvalidationService.js');
        invalidationService.registerWatcher('https://raw.githubusercontent.com/openai/openai-openapi/master/openapi.yaml', ['cache:llm:openai:*']);
      }

      console.log('[Startup] PatternEngine: SKIPPED (Local Dev Mode)');
    }
  } catch (e) {
    console.error('[Startup] PatternEngine failed to start:', e);
  }
})();

// DEBUG ENDPOINT (Admin-only)
app.get('/api/debug-env', (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  return c.json({
    status: 'alive',
    env: {
      node_env: process.env.NODE_ENV,
      has_db_url: !!process.env.DATABASE_URL,
      has_redis: !!process.env.REDIS_URL || !!process.env.UPSTASH_REDIS_URL,
      has_jwt: !!process.env.JWT_SECRET,
      has_admin: !!process.env.ADMIN_TOKEN
    }
  });
});

// Global Error Handler
app.onError((err, c) => {
  console.error('[Global Error]', err);
  return c.json({
    error: 'Internal Server Error',
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  }, 500);
});

// Environment
const PORT = process.env.PORT || 3001;

// CORS for API routes
app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));

// Agent discovery header — any agent calling any API endpoint discovers the onboarding path
app.use('*', async (c, next) => {
  // Global Security Headers (Best Practices)
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');

  await next();

  if (c.req.path.startsWith('/api')) {
    c.header('X-Agent-Onboard', 'https://agentcache.ai/skill.md');
    c.header('X-Agent-Manifest', 'https://agentcache.ai/.well-known/agents.json');
    c.header('X-MCP-Manifest', 'https://agentcache.ai/mcp/manifest');
  }
});

// Lazy Loader Helper
const lazy = (loader: () => Promise<any>) => {
  return async (c: any, next: any) => {
    try {
      const module = await loader();
      const router = module.default || Object.values(module).find(v => v instanceof Hono) || module.router;
      if (!router) {
        console.error(`[Lazy] Router not found in module for path: ${c.req.path}`);
        throw new Error('Lazy router not found in module');
      }

      // Calculate path relative to the mount point
      let subPath = c.req.param('path') || c.req.param('sub');
      if (subPath) {
        subPath = subPath.startsWith('/') ? subPath : '/' + subPath;
      } else {
        const parts = c.req.path.split('/');
        subPath = '/' + parts.slice(3).join('/');
      }

      // Handle disturbed/locked body (WAF middleware consumes it)
      const method = c.req.method;
      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        try {
          const body = await c.req.json().catch(() => null);
          return router.request(subPath, {
            method,
            headers: c.req.header(),
            body: body ? JSON.stringify(body) : undefined
          }, c.env);
        } catch (bodyErr) {
          // If body reading fails or is already locked, try native fetch fallback
          return router.request(subPath, c.req.raw, c.env);
        }
      }

      return router.request(subPath, c.req.raw, c.env);
    } catch (err) {
      console.error(`[Lazy] Critical Error mounting ${c.req.path}:`, err);
      return c.json({ error: 'Lazy Load Error', message: err instanceof Error ? err.message : String(err) }, 500);
    }
  };
};

// Mounted lazily below

// Mount Vercel integration routes
app.all('/api/integrations/vercel/:path{.+}?', lazy(() => import('./integrations/vercel.js')));

// -----------------------------------------------------------------------------
// Security & Auth
// -----------------------------------------------------------------------------
import { authenticateApiKey } from './middleware/auth.js';
import { cognitiveMemory } from './services/cognitive-memory.js';



app.post('/api/provision', async (c) => {
  const { provisionClient } = await import('./api/provision-hono.js');
  return provisionClient(c);
});
// Mount Content API for Bento Grid
// Mount Content API for Bento Grid
app.all('/api/content/:path{.+}?', lazy(() => import('./api/content.js')));

app.get('/api/provision/:api_key', async (c) => {
  const { getApiKeyInfo } = await import('./api/provision-hono.js');
  return getApiKeyInfo(c);
});

app.post('/api/provision/jettythunder', async (c) => {
  const { provisionJettyThunder } = await import('./api/provision-hono.js');
  return provisionJettyThunder(c);
});

// ClawSave.com API (Brain + Memory via AgentCache, Storage via JettyThunder)
// ClawSave.com API (Brain + Memory via AgentCache, Storage via JettyThunder)
app.get('/api/clawsave', async (c) => {
    const { clawHealth } = await import('./api/clawsave.js');
    return clawHealth(c);
});
app.post('/api/claw/agent', async (c) => {
    const { clawAgent } = await import('./api/clawsave.js');
    return clawAgent(c);
});
app.post('/api/claw/storage', async (c) => {
    const { clawStorage } = await import('./api/clawsave.js');
    return clawStorage(c);
});
app.post('/api/claw/provision', async (c) => {
    const { clawProvision } = await import('./api/clawsave.js');
    return clawProvision(c);
});

// ClawSave Unified Memory API (4-layer agent storage)
app.post('/api/claw/memory/store', async (c) => {
    const { clawMemoryStore } = await import('./api/clawsave.js');
    return clawMemoryStore(c);
});
app.post('/api/claw/memory/recall', async (c) => {
    const { clawMemoryRecall } = await import('./api/clawsave.js');
    return clawMemoryRecall(c);
});
app.post('/api/claw/memory/forget', async (c) => {
    const { clawMemoryForget } = await import('./api/clawsave.js');
    return clawMemoryForget(c);
});
app.post('/api/claw/memory/share', async (c) => {
    const { clawMemoryShare } = await import('./api/clawsave.js');
    return clawMemoryShare(c);
});

// Mount Auth API
app.all('/api/auth/:path{.+}?', lazy(() => import('./api/auth.js')));
app.all('/api/billing/:path{.+}?', lazy(() => import('./api/billing.js')));
app.all('/api/credits/:path{.+}?', lazy(() => import('./api/credits.js')));
app.all('/api/marketplace/:path{.+}?', lazy(() => import('./api/marketplace.js')));

// Mount Muscle API (JettyThunder)
app.all('/api/muscle/:path{.+}?', lazy(() => import('./api/muscle.js')));

// Mount Brain API (AutoMem)
app.all('/api/brain/:path{.+}?', lazy(() => import('./api/brain.js')));

// Mount Services
app.all('/api/memory/:path{.+}?', lazy(() => import('./api/memory.js')));
app.all('/api/cognitive/:path{.+}?', lazy(() => import('./api/cognitive.js')));
app.all('/api/security/:path{.+}?', lazy(() => import('./api/security.js')));
app.all('/api/cache/:path{.+}?', lazy(() => import('./api/cache.js')));

// Mount Decisions & Galaxy API
app.all('/api/decisions/:path{.+}?', lazy(() => import('./api/decisions.js')));
app.all('/api/galaxy/:path{.+}?', lazy(() => import('./api/galaxy.js')));
app.all('/api/explorer/:path{.+}?', lazy(() => import('./api/explorer.js')));
app.all('/api/governance/:path{.+}?', lazy(() => import('./api/governance.js')));
app.all('/api/lab/:path{.+}?', lazy(() => import('./api/lab.js')));
app.all('/api/admin/:path{.+}?', lazy(() => import('./api/admin.js')));

// Mount Treasury Sub-route
app.all('/api/admin/treasury/:path{.+}?', lazy(() => import('./api/admin/treasury_v2.js')));
app.all('/api/admin/truth/:path{.+}?', lazy(() => import('./api/admin/truth.js')));
app.all('/api/admin/cortex/:path{.+}?', lazy(() => import('./api/admin/cortex.js')));
app.all('/api/admin/defense/:path{.+}?', lazy(() => import('./api/admin/defense.js')));

// Admin/Internal APIs
app.all('/api/admin/armor/:path{.+}?', lazy(() => import('./api/admin/armor.js')));

// Aggregate Health (all subsystems)
app.all('/api/admin/health/:path{.+}?', lazy(() => import('./api/admin/health.js')));

app.all('/api/admin/agents/:path{.+}?', lazy(() => import('./api/admin/agents.js')));

app.all('/api/admin/swarm/:path{.+}?', lazy(() => import('./api/admin/swarm.js')));

app.all('/api/admin/pipeline/:path{.+}?', lazy(() => import('./api/admin/pipeline.js')));

app.all('/api/admin/symbiont/:path{.+}?', lazy(() => import('./api/admin/symbiont.js')));


// Platform Revenue Reporting
app.all('/api/platform/:path{.+}?', lazy(() => import('./api/platform.js')));

// Public V1 API
app.all('/api/v1/:path{.+}?', lazy(() => import('./api/v1/router.js')));

app.all('/mcp/:path{.+}?', lazy(() => import('./api/mcp/router.js')));

app.all('/api/events/:path{.+}?', lazy(() => import('./api/events.js')));
app.all('/api/patterns/:path{.+}?', lazy(() => import('./api/patterns.js')));
app.all('/api/geo/:path{.+}?', lazy(() => import('./api/geo.js')));
app.all('/api/cdn/:path{.+}?', lazy(() => import('./api/cdn.js')));
app.all('/api/transcode/:path{.+}?', lazy(() => import('./api/transcode.js')));

app.all('/api/pipeline/:path{.+}?', lazy(() => import('./api/pipeline.js')));

app.all('/api/motion/:path{.+}?', lazy(() => import('./api/motion.js')));

app.all('/api/biotech/:path{.+}?', lazy(() => import('./api/biotech.js')));

app.all('/api/finance/:path{.+}?', lazy(() => import('./api/finance.js')));

app.all('/api/ontology/:path{.+}?', lazy(() => import('./api/ontology.js')));

app.all('/api/sentry/:path{.+}?', lazy(() => import('./api/sentry.js')));
app.all('/api/lemma/:path{.+}?', lazy(() => import('./api/lemma.js')));

// Agent Hub API (LinkedIn meets Yelp for agents)
app.all('/api/hub/:path{.+}?', lazy(() => import('./api/hub.js')));

// Alias: /api/agents/register → hub agent registration (shorthand URL)
app.get('/api/agents/register', async (c) => {
  const accept = c.req.header('Accept') || '';
  if (accept.includes('application/json')) {
    return c.json({
      welcome: "Hello! I'm AgentCache — the social network for autonomous agents.",
      message: 'Send a POST to this endpoint with your name and role to register.',
      method: 'POST',
      url: 'https://www.maxxeval.com/api/agents/register',
      requiredFields: { name: 'string', role: 'string' },
      optionalFields: { capabilities: 'string[]', domain: 'string[]', wallet: 'string (0x...)' },
    });
  }
  c.header('Content-Type', 'text/plain; charset=utf-8');
  return c.body('Welcome. POST to this URL with JSON: { "name": "...", "role": "..." }\n\nFull docs: https://www.maxxeval.com/skill.md\n');
});

app.post('/api/agents/register', async (c) => {
  try {
    const { agentRegistry } = await import('./lib/hub/registry.js');
    const body = await c.req.json();
    if (!body.name || !body.role) {
      return c.json({ error: 'Missing required fields: name, role' }, 400);
    }
    const result = await agentRegistry.register(body);
    return c.json({
      success: true,
      apiKey: result.apiKey,
      agentId: result.agentId,
      message: 'Welcome to AgentCache Hub!',
      nextStep: 'POST /api/hub/focus-groups/onboarding/join',
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});
// Needs mirror API (MaxxEval system of record)
app.all('/api/needs/:path{.+}?', lazy(() => import('./api/needs.js')));
// Service catalog + custom cache requests
app.all('/api/catalog/:path{.+}?', lazy(() => import('./api/catalog.js')));
// Focus Group API (full study/session/analysis system)
app.all('/api/focus-group/:path{.+}?', lazy(() => import('./api/focus-group.js')));
// Tool Safety Scanner (supply chain security for agent tools)
app.all('/api/tools/scan/:path{.+}?', lazy(() => import('./api/tool-scanner.js')));
app.all('/api/sentry/:path{.+}?', lazy(() => import('./api/sentry.js')));

// Serve specific discovery paths for agents
app.get('/skill.md', async (c) => {
  const { generateSkillMd } = await import('./lib/hub/discovery.js');
  c.header('Content-Type', 'text/markdown; charset=utf-8');
  return c.body(generateSkillMd());
});

app.get('/.well-known/agents.json', async (c) => {
  const { generateAgentsJson } = await import('./lib/hub/discovery.js');
  return c.json(generateAgentsJson());
});

// Content-negotiated root: Dual Front Door
// - Accept: application/json → agents.json manifest
// - Accept: text/markdown    → skill.md onboarding doc
// - Default (HTML browsers)  → index.html landing page
app.get('/', async (c) => {
  const accept = c.req.header('Accept') || '';

  if (accept.includes('application/json') && !accept.includes('text/html')) {
    const { generateAgentsJson } = await import('./lib/hub/discovery.js');
    return c.json(generateAgentsJson());
  }

  if (accept.includes('text/markdown')) {
    const { generateSkillMd } = await import('./lib/hub/discovery.js');
    c.header('Content-Type', 'text/markdown; charset=utf-8');
    return c.body(generateSkillMd());
  }

  return c.redirect('/index.html');
});

// Clean URL Redirects
app.get('/admin', (c) => c.redirect('/admin-dashboard.html'));
app.get('/mission-control', (c) => c.redirect('/mission-control.html')); // Keep legacy access
app.get('/login', (c) => c.redirect('/login.html'));
app.get('/dashboard', (c) => c.redirect('/user-dashboard.html'));
app.get('/workspace', (c) => c.redirect('/user-dashboard.html'));
app.get('/reset-password', (c) => c.redirect('/reset-password.html'));
app.get('/drift-manifold', (c) => c.redirect('/index.html?view=topo'));
app.get('/manifold', (c) => c.redirect('/index.html?view=topo'));
app.get('/galaxy', (c) => c.redirect('/index.html?view=galaxy'));

// Agent Hub Routes
app.get('/hub', (c) => c.redirect('/hub.html'));
app.get('/skill.md', async (c) => {
  const { generateSkillMd } = await import('./lib/hub/discovery.js');
  c.header('Content-Type', 'text/markdown; charset=utf-8');
  return c.body(generateSkillMd());
});

// app.use('/*', serveStatic({ root: './public' }));

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
  semantic: z.boolean().optional().default(false), // Semantic Caching
});

type CacheRequest = z.infer<typeof CacheRequestSchema>;

// Helper: Generate cache key
// Helper: Generate cache key using Deterministic Serialization
function generateCacheKey(req: CacheRequest): string {
  const data = {
    provider: req.provider,
    model: req.model,
    messages: req.messages,
    temperature: req.temperature,
  };
  const hash = stableHash(data);
  return `agentcache:v1:${req.provider}:${req.model}:${hash}`;
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
 * POST /api/agent/chat - Stateful Agent Chat with Virtual Memory + Reasoning Cache
 */

/**
 * POST /api/agent/chat - Stateful Agent Chat with Virtual Memory + Reasoning Cache
 */
app.post('/api/agent/chat', async (c) => {
  const apiKey = c.req.header('X-API-Key');
  if (!apiKey) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const body = await c.req.json();
    const { sessionId, message, freshness, provider = 'moonshot', model } = body;

    if (!sessionId || !message) {
      return c.json({ error: 'Missing sessionId or message' }, 400);
    }

    // 0. Security: Pre-execution Input Validation (Reprompt Protection)
    // We check this BEFORE fetching context or calling the LLM to prevent extraction attacks.
    const securityCheck = await getContextManager().validateInput(message);
    if (!securityCheck.valid) {
      console.warn(`[Security] Blocked Reprompt/Injection attempt: ${securityCheck.reason}`);
      return c.json({
        error: 'Input rejected by security guardrails',
        reason: securityCheck.reason
      }, 403);
    }

    // 1. Get Context (with optional Freshness Bypass)
    const context = await getContextManager().getContext(sessionId, message, { freshness });

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

    // 3. Call AI Provider (via Factory)
    let aiResponse: string;
    let reasoningMetadata: any = {};

    try {
      // Dynamic Import of Factory to avoid circular deps if any
      const { LLMFactory } = await import('./lib/llm/factory.js');
      const llm = LLMFactory.createProvider(provider as any);

      const response = await llm.chat(llmMessages, { model });

      aiResponse = response.content;
      reasoningMetadata = {
        ...response.usage,
        model: response.model,
        provider: response.provider,
        citations: response.metadata?.citations // Capture Perplexity citations
      };

    } catch (error: any) {
      console.error(`[${provider}] API call failed:`, error.message);
      aiResponse = `[Error from ${provider}: ${error.message}]`;
    }

    // 4. Save Interaction (Write-Through with reasoning metadata)
    await getContextManager().saveInteraction(sessionId, message, aiResponse, reasoningMetadata);

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

    await getContextManager().deleteMemory(id);

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
    const result = await getCacheInvalidator().invalidate({
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
    const listenerId = await getUrlMonitor().registerListener({
      url,
      checkInterval,
      namespace,
      invalidateOnChange,
      webhook,
      enabled: true
    });

    const listener = await getUrlMonitor().getListener(listenerId);

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
    const listeners = await getUrlMonitor().getAllListeners();

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

    const success = getUrlMonitor().unregisterListener(id);

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
 * GET /api/stats - Usage statistics with tier info
 */
app.get('/api/stats', async (c) => {
  const authError = await authenticateApiKey(c);
  if (authError) return authError;

  const usage = c.get('usage') || { used: 0, quota: 10000, remaining: 10000 };
  const tier = c.get('tier') || 'free';
  const tierFeatures = c.get('tierFeatures');

  return c.json({
    tier,
    monthlyQuota: usage.quota === -1 ? 'unlimited' : usage.quota,
    used: usage.used,
    remaining: usage.remaining === -1 ? 'unlimited' : usage.remaining,
    percentUsed: usage.quota === -1 ? 0 : Math.round((usage.used / usage.quota) * 100),
    resetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
    features: tierFeatures,
    cognitive: await cognitiveMemory.getStatus(),
  });
});

/**
 * GET /api/pricing - Get all pricing tiers (public endpoint)
 */
app.get('/api/pricing', (c) => {
  const tiers = getAllTiers().map(tier => ({
    id: tier.id,
    name: tier.name,
    price: tier.price,
    quota: tier.quota,
    features: {
      namespaces: tier.features.namespaces,
      ttlMaxDays: tier.features.ttlMax === -1 ? 'unlimited' : Math.floor(tier.features.ttlMax / (24 * 60 * 60 * 1000)),
      pipelineNodes: tier.features.pipelineNodes,
      privateNamespace: tier.features.privateNamespace,
      analytics: tier.features.analytics,
      support: tier.features.support
    }
  }));

  return c.json({ tiers });
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

      return new Response(chunkBuffer as any, {
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

      return new Response(chunkBuffer as any, {
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
        response: JSON.parse(cached as string),
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
 * POST /api/qr/generate - Generate QR pairing code
 */
app.post('/api/qr/generate', async (c) => {
  try {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL || '');

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store in database
    await sql`
      INSERT INTO qr_pairing_codes (code, status, expires_at)
      VALUES (${code}, 'pending', ${expiresAt.toISOString()})
    `;

    const qrUrl = `${process.env.PUBLIC_URL || 'https://agentcache.ai'}/mobile-auth.html?code=${code}`;

    return c.json({
      code,
      qrUrl,
      expiresAt: expiresAt.toISOString()
    });
  } catch (error: any) {
    console.error('[QR Auth] Generate error:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * POST /api/qr/approve - Approve QR code and provision API key
 */
app.post('/api/qr/approve', async (c) => {
  try {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL || '');
    const body = await c.req.json();
    const { code, email } = body;

    if (!code || !email) {
      return c.json({ error: 'Code and email required' }, 400);
    }

    // Verify code exists and is pending
    const pairing = await sql`
      SELECT * FROM qr_pairing_codes 
      WHERE code = ${code} AND status = 'pending' AND expires_at > NOW()
      LIMIT 1
    `;

    if (!pairing || pairing.length === 0) {
      return c.json({ error: 'Invalid or expired code' }, 404);
    }

    // Provision API key
    const { generateApiKey } = await import('./services/provisioning.js');
    const userId = email.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const apiKey = await generateApiKey({
      user_id: userId,
      integration: 'qr_auth',
      project_id: `qr_${Date.now()}`
    });

    // Set quota in Redis
    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    await redis.set(`usage:${keyHash}:quota`, '10000');

    // Update pairing record
    await sql`
      UPDATE qr_pairing_codes 
      SET status = 'approved', 
          email = ${email},
          api_key = ${apiKey},
          approved_at = NOW()
      WHERE code = ${code}
    `;

    return c.json({
      success: true,
      message: 'API key provisioned'
    });
  } catch (error: any) {
    console.error('[QR Auth] Approve error:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * GET /api/qr/status - Check QR code approval status
 */
app.get('/api/qr/status', async (c) => {
  try {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL || '');
    const code = c.req.query('code');

    if (!code) {
      return c.json({ error: 'Code required' }, 400);
    }

    const pairing = await sql`
      SELECT status, api_key, email FROM qr_pairing_codes 
      WHERE code = ${code}
      LIMIT 1
    `;

    if (!pairing || pairing.length === 0) {
      return c.json({ error: 'Code not found' }, 404);
    }

    const result = pairing[0];

    if (result.status === 'approved') {
      return c.json({
        status: 'approved',
        apiKey: result.api_key,
        email: result.email
      });
    }

    return c.json({ status: result.status });
  } catch (error: any) {
    console.error('[QR Auth] Status error:', error);
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
    agentOnboarding: {
      '/skill.md': 'Agent onboarding doc (markdown)',
      '/.well-known/agents.json': 'Machine-readable discovery manifest',
      '/mcp/manifest': 'MCP tool manifest (Claude, Cursor)',
      '/api/hub/agents/register': 'Register your agent (GET for instructions, POST to register)',
      '/api/hub/heartbeat': 'Personalized opportunities (poll every 4h)',
      '/api/catalog': 'Browse available cache services',
      '/api/needs': 'Current demand signals from agents',
      '/api/needs/trends': 'Aggregated trends and velocity',
      '/api/tools/scan': 'Tool Safety Scanner — scan tools before installing (POST source code)',
    },
    endpoints: {
      '/api/health': 'Health check',
      '/api/auth/signup': 'Create account and start workspace onboarding',
      '/api/cache/check': 'Check if response is cached',
      '/api/cache/get': 'Get cached response',
      '/api/cache/set': 'Store response in cache',
      '/api/cache/invalidate': 'Invalidate caches (Anti-Cache)',
      '/api/listeners/register': 'Register URL monitoring (Anti-Cache)',
      '/api/overflow': 'Elastic overflow for partners',
      '/api/stats': 'Usage statistics',
      '/api/memory/store': 'Store a memory item (vector + metadata)',
      '/api/memory/recall': 'Recall similar memories (vector search)',
      '/api/memory/:id': 'Fetch a stored memory by id',
      '/api/security/check': 'Prompt injection / jailbreak detection',
      '/api/tools/scan': 'Scan tool source code for threats (JS/TS + Python + MCP)',
      '/api/tools/scan/:hash': 'Lookup previous scan by content hash',
      '/api/tools/scan/stats': 'Aggregate scan statistics',
      '/api/edges/optimal': 'Get optimal edge locations (JettySpeed)',
      '/api/jetty-speed/chunk': 'Upload chunk via edge (JettySpeed)',
      '/api/jetty-speed/chunk/:fileId/:chunkIndex': 'Download cached chunk (JettySpeed)',
    },
    focusGroups: 'https://maxxeval.com/api/focus-groups/join',
  });
});

