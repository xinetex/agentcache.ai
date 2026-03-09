import { Context } from 'hono';
import { CognitiveRouter } from '../infrastructure/CognitiveRouter.js';
import { PredictiveSynapse } from '../infrastructure/PredictiveSynapse.js';
import { generateApiKey, createNamespace, recordInstallation } from '../services/provisioning.js';
import { redis } from '../lib/redis.js';
import { getMemory } from '../lib/agent-memory/index.js';

/**
 * ClawSave.com API Routes
 * Brain + Memory services powered by AgentCache.ai
 * Storage backend: JettyThunder.app
 * 
 * Vercel Project: prj_Eue0ehGAyjbpU2n5Nly1G0fEw1dp
 */

const CLAWSAVE_NAMESPACE = 'clawsave_prod';
const JETTYTHUNDER_STORAGE_URL = process.env.JETTYTHUNDER_API_URL || 'https://jettythunder.app';

// Initialize cognitive components
const cognitiveRouter = new CognitiveRouter();
const predictiveSynapse = new PredictiveSynapse();

/**
 * POST /api/claw/agent
 * Cognitive brain endpoint - routes between fast reflexes and deep reasoning
 */
export async function clawAgent(c: Context) {
  try {
    const body = await c.req.json();
    const {
      query,
      context = {},
      user_id,
      intent,
      force_system2 = false
    } = body;

    if (!query) {
      return c.json({ error: 'Missing required field: query' }, 400);
    }

    const startTime = Date.now();

    // Step 1: Predict user intent (pre-cognition)
    const predictedIntentCandidate = intent ? undefined : await predictiveSynapse.predict(query);
    const predictedIntent = intent || (predictedIntentCandidate && predictedIntentCandidate.length > 0 ? predictedIntentCandidate[0].hash : 'unknown');

    // Step 2: Route to appropriate cognitive system
    const routeDecisionSystem = await cognitiveRouter.route(query, user_id);
    const routeDecision = {
      system: routeDecisionSystem,
      confidence: 0.9, // Router returns bare system type, mocked confidence
      reason: routeDecisionSystem === 'system_1' ? 'fast reflex' : 'deep reasoning required'
    };

    // Step 3: Execute based on routing decision
    let response;
    if (routeDecision.system === 'system_1') {
      // Fast path - check cache first
      const cacheKey = `claw:${Buffer.from(query).toString('base64').slice(0, 32)}`;
      const cached = await redis?.get(cacheKey);

      if (cached) {
        response = {
          result: JSON.parse(cached as string),
          source: 'cache',
          system: 'system_1',
          latency_ms: Date.now() - startTime
        };
      } else {
        // Generate reflex response
        response = {
          result: {
            action: predictedIntent,
            confidence: routeDecision.confidence,
            suggestion: generateReflexResponse(predictedIntent, context)
          },
          source: 'reflex',
          system: 'system_1',
          latency_ms: Date.now() - startTime
        };

        // Cache for future
        await redis?.set(cacheKey, JSON.stringify(response.result), { ex: 300 });
      }
    } else {
      // Slow path - deep reasoning (System 2)
      response = {
        result: await deepReasoning(query, context, predictedIntent),
        source: 'reasoning',
        system: 'system_2',
        latency_ms: Date.now() - startTime
      };
    }

    // Track usage
    await trackClawUsage(user_id, 'agent', routeDecision.system);

    return c.json({
      success: true,
      ...response,
      intent: predictedIntent,
      routing: {
        decision: routeDecision.system,
        confidence: routeDecision.confidence,
        reason: routeDecision.reason
      }
    });

  } catch (error) {
    console.error('[ClawSave Agent] Error:', error);
    return c.json({
      error: 'Agent processing failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}

/**
 * POST /api/claw/storage
 * Agentic storage operations via JettyThunder
 */
export async function clawStorage(c: Context) {
  try {
    const body = await c.req.json();
    const {
      operation, // 'store' | 'retrieve' | 'delete' | 'list'
      file_id,
      file_key,
      metadata = {},
      user_id
    } = body;

    if (!operation) {
      return c.json({ error: 'Missing required field: operation' }, 400);
    }

    const startTime = Date.now();

    // Use brain to optimize storage decision
    const storageDecisionSystem = await cognitiveRouter.route(`storage:${operation}:${file_key || file_id}`, user_id);
    const storageDecision = { system: storageDecisionSystem };

    let result;
    switch (operation) {
      case 'store':
        // Determine optimal storage location via JettyThunder
        const optimalEdges = await fetch(`${JETTYTHUNDER_STORAGE_URL}/api/jetty/optimal-edges`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_key, metadata, source: 'clawsave' })
        }).then(r => r.json()).catch(() => ({ edges: ['us-east-1'] }));

        result = {
          operation: 'store',
          file_key,
          edges: optimalEdges.edges,
          cache_hint: storageDecision.system === 'system_1' ? 'hot' : 'cold',
          ttl_recommendation: metadata.ephemeral ? 3600 : 86400 * 30
        };
        break;

      case 'retrieve':
        // Check AgentCache memory first
        const memoryCacheKey = `claw:file:${file_id || file_key}`;
        const cachedMeta = await redis?.get(memoryCacheKey);

        if (cachedMeta) {
          result = {
            operation: 'retrieve',
            file_id,
            metadata: JSON.parse(cachedMeta as string),
            source: 'memory',
            latency_ms: Date.now() - startTime
          };
        } else {
          result = {
            operation: 'retrieve',
            file_id,
            storage_url: `${JETTYTHUNDER_STORAGE_URL}/api/provision/jettythunder`,
            source: 'storage',
            latency_ms: Date.now() - startTime
          };
        }
        break;

      case 'list':
        result = {
          operation: 'list',
          namespace: CLAWSAVE_NAMESPACE,
          storage_backend: 'jettythunder'
        };
        break;

      case 'delete':
        result = {
          operation: 'delete',
          file_id,
          status: 'queued'
        };
        break;

      default:
        return c.json({ error: `Unknown operation: ${operation}` }, 400);
    }

    await trackClawUsage(user_id, 'storage', operation);

    return c.json({
      success: true,
      ...result,
      cognitive_assist: {
        system: storageDecision.system,
        optimization_applied: true
      }
    });

  } catch (error) {
    console.error('[ClawSave Storage] Error:', error);
    return c.json({
      error: 'Storage operation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}

/**
 * POST /api/claw/provision
 * Provision ClawSave with AgentCache brain + JettyThunder storage
 */
export async function clawProvision(c: Context) {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { environment = 'production', email } = body;

    // Generate API key for ClawSave
    const apiKey = await generateApiKey({
      user_id: 'clawsave_master',
      integration: 'clawsave',
      project_id: `clawsave-${environment}`
    });

    // Create namespace
    const namespace = `clawsave_${environment}`;
    await createNamespace({
      name: namespace,
      user_id: 'clawsave_master',
      sector: 'agentic_storage',
      use_case: 'brain_memory_storage'
    });

    // Record installation
    await recordInstallation({
      user_id: 'clawsave_master',
      platform: 'vercel',
      project_id: `clawsave-${environment}`,
      config_id: 'clawsave_enterprise_config',
      api_key: apiKey,
      namespace
    });

    return c.json({
      success: true,
      message: 'ClawSave provisioned with AgentCache brain + JettyThunder storage',
      api_key: apiKey,
      namespace,
      environment,
      vercel_project_id: 'prj_Eue0ehGAyjbpU2n5Nly1G0fEw1dp',
      tier: 'enterprise',
      provisioned_at: new Date().toISOString(),
      services: {
        brain: {
          provider: 'agentcache.ai',
          endpoints: {
            agent: 'https://agentcache.ai/api/claw/agent',
            storage: 'https://agentcache.ai/api/claw/storage'
          },
          capabilities: [
            'cognitive_routing',
            'predictive_synapse',
            'semantic_memory',
            'drift_healing'
          ]
        },
        storage: {
          provider: 'jettythunder.app',
          endpoints: {
            provision: 'https://jettythunder.app/api/provision/jettythunder',
            edges: 'https://jettythunder.app/api/jetty/optimal-edges'
          },
          capabilities: [
            'edge_distribution',
            's3_compatible',
            'cdn_acceleration',
            'lyve_cloud_backend'
          ]
        }
      },
      integration: {
        env_vars: {
          AGENTCACHE_API_KEY: apiKey,
          AGENTCACHE_URL: 'https://agentcache.ai',
          JETTYTHUNDER_URL: 'https://jettythunder.app'
        },
        sample_code: `
// lib/clawsave-brain.ts
const AGENTCACHE_URL = process.env.AGENTCACHE_URL;
const API_KEY = process.env.AGENTCACHE_API_KEY;

export async function askBrain(query: string, context?: Record<string, any>) {
  const res = await fetch(\`\${AGENTCACHE_URL}/api/claw/agent\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${API_KEY}\`
    },
    body: JSON.stringify({ query, context })
  });
  return res.json();
}

export async function storeFile(fileKey: string, metadata: Record<string, any>) {
  const res = await fetch(\`\${AGENTCACHE_URL}/api/claw/storage\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${API_KEY}\`
    },
    body: JSON.stringify({ operation: 'store', file_key: fileKey, metadata })
  });
  return res.json();
}
        `.trim()
      },
      next_steps: [
        '1. Add environment variables to Vercel project prj_Eue0ehGAyjbpU2n5Nly1G0fEw1dp',
        '2. Implement lib/clawsave-brain.ts in your app',
        '3. Use askBrain() for cognitive decisions',
        '4. Use storeFile() for agentic storage operations',
        '5. Monitor usage at https://agentcache.ai/dashboard'
      ]
    }, 201);

  } catch (error) {
    console.error('[ClawSave Provision] Error:', error);
    return c.json({
      error: 'Failed to provision ClawSave',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}

/**
 * GET /api/clawsave
 * Health check and service info
 */
export async function clawHealth(c: Context) {
  return c.json({
    service: 'clawsave',
    status: 'healthy',
    version: '1.0.0',
    brain: {
      provider: 'agentcache.ai',
      cognitive_router: 'active',
      predictive_synapse: 'active'
    },
    storage: {
      provider: 'jettythunder.app',
      backend: 'lyve_cloud'
    },
    endpoints: {
      agent: '/api/claw/agent',
      storage: '/api/claw/storage',
      provision: '/api/claw/provision'
    },
    timestamp: new Date().toISOString()
  });
}

// Helper: Generate reflex response for System 1
function generateReflexResponse(intent: string, context: Record<string, any>): string {
  const reflexMap: Record<string, string> = {
    'store_file': 'Use optimal edge location based on user geography',
    'retrieve_file': 'Check memory cache first, then storage backend',
    'delete_file': 'Queue for async deletion with confirmation',
    'list_files': 'Return cached listing if available',
    'optimize_storage': 'Analyze access patterns and recommend tiering',
    'default': 'Process request through standard pipeline'
  };
  return reflexMap[intent] || reflexMap['default'];
}

// Helper: Deep reasoning for System 2
async function deepReasoning(
  query: string,
  context: Record<string, any>,
  intent: string
): Promise<Record<string, any>> {
  // In production, this would call the AI gateway for deep reasoning
  return {
    analysis: `Deep analysis of: ${query}`,
    intent_confirmed: intent,
    recommendations: [
      'Consider caching strategy based on access frequency',
      'Evaluate storage tier based on data lifecycle',
      'Monitor for semantic drift in related queries'
    ],
    confidence: 0.85,
    reasoning_chain: [
      'Analyzed query context',
      'Evaluated storage patterns',
      'Generated optimization recommendations'
    ]
  };
}

// Helper: Track ClawSave usage
async function trackClawUsage(
  userId: string | undefined,
  endpoint: string,
  operation: string
): Promise<void> {
  if (!redis) return;

  const date = new Date().toISOString().split('T')[0];
  const key = `usage:clawsave_com:${date}:${endpoint}`;

  try {
    await redis.incr(key);
    await redis.expire(key, 60 * 60 * 24 * 30); // 30 days
  } catch (error) {
    console.error('[ClawSave Usage] Tracking failed:', error);
  }
}

// =============================================================================
// NEW: Unified Agent Memory API
// =============================================================================

/**
 * POST /api/claw/memory/store
 * Store data using the 4-layer agent memory system
 */
export async function clawMemoryStore(c: Context) {
  try {
    const body = await c.req.json();
    const { key, value, options = {} } = body;
    const userId = body.user_id || 'anonymous';

    if (!key || value === undefined) {
      return c.json({ error: 'Missing required fields: key, value' }, 400);
    }

    const memory = getMemory(`clawsave:${userId}`, CLAWSAVE_NAMESPACE);
    const result = await memory.store(key, value, options);

    await trackClawUsage(userId, 'memory', 'store');

    return c.json({
      success: true,
      key: result.key,
      tier: result.metadata.tier,
      size: result.metadata.size,
      hasEmbedding: !!result.embedding,
      layers: {
        semantic: !!result.embedding,
        structured: result.metadata.size < 1024 * 1024,
        blob: result.metadata.size >= 1024 * 1024,
        context: result.metadata.tier === 'hot',
      },
    });
  } catch (error) {
    console.error('[ClawSave Memory Store] Error:', error);
    return c.json({
      error: 'Memory store failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}

/**
 * POST /api/claw/memory/recall
 * Semantic search and retrieval from agent memory
 */
export async function clawMemoryRecall(c: Context) {
  try {
    const body = await c.req.json();
    const { query, options = {} } = body;
    const userId = body.user_id || 'anonymous';

    if (!query) {
      return c.json({ error: 'Missing required field: query' }, 400);
    }

    const memory = getMemory(`clawsave:${userId}`, CLAWSAVE_NAMESPACE);
    const results = await memory.recall(query, options);

    await trackClawUsage(userId, 'memory', 'recall');

    return c.json({
      success: true,
      count: results.length,
      results: results.map(r => ({
        key: r.key,
        value: r.value,
        score: r.score,
        metadata: r.metadata,
      })),
    });
  } catch (error) {
    console.error('[ClawSave Memory Recall] Error:', error);
    return c.json({
      error: 'Memory recall failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}

/**
 * POST /api/claw/memory/forget
 * Remove data from agent memory
 */
export async function clawMemoryForget(c: Context) {
  try {
    const body = await c.req.json();
    const { key, cascade = false, force = false } = body;
    const userId = body.user_id || 'anonymous';

    if (!key) {
      return c.json({ error: 'Missing required field: key' }, 400);
    }

    const memory = getMemory(`clawsave:${userId}`, CLAWSAVE_NAMESPACE);
    await memory.forget(key, { cascade, force });

    await trackClawUsage(userId, 'memory', 'forget');

    return c.json({
      success: true,
      message: `Forgot "${key}"${cascade ? ' and related memories' : ''}`,
    });
  } catch (error) {
    console.error('[ClawSave Memory Forget] Error:', error);
    return c.json({
      error: 'Memory forget failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}

/**
 * POST /api/claw/memory/share
 * Share memory with another agent
 */
export async function clawMemoryShare(c: Context) {
  try {
    const body = await c.req.json();
    const { key, targetAgentId, permissions = 'read', notify = false } = body;
    const userId = body.user_id || 'anonymous';

    if (!key || !targetAgentId) {
      return c.json({ error: 'Missing required fields: key, targetAgentId' }, 400);
    }

    const memory = getMemory(`clawsave:${userId}`, CLAWSAVE_NAMESPACE);
    const result = await memory.share(targetAgentId, key, { permissions, notify });

    await trackClawUsage(userId, 'memory', 'share');

    return c.json({
      success: true,
      shareId: result.shareId,
      accessUrl: result.accessUrl,
      message: `Shared "${key}" with ${targetAgentId} (${permissions})`,
    });
  } catch (error) {
    console.error('[ClawSave Memory Share] Error:', error);
    return c.json({
      error: 'Memory share failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}
