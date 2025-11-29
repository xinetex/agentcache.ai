import { Context } from 'hono';
import { generateApiKey, createNamespace, recordInstallation, validateApiKey } from '../services/provisioning.js';

/**
 * POST /api/provision
 * Generate API key for a new client integration
 */
export async function provisionClient(c: Context) {
  try {
    const body = await c.req.json();
    const {
      email,
      user_id,
      integration,
      project_id,
      tier = 'free',
      plan = 'free',
      namespace = 'community',
      rate_limit,
      sector,
      use_case
    } = body;

    // Community Edition: simplified signup with just email
    if (email && plan === 'free' && namespace === 'community') {
      const userId = email.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const apiKey = await generateApiKey({
        user_id: userId,
        integration: 'community',
        project_id: `community_${Date.now()}`
      });

      await createNamespace({
        name: 'community',
        user_id: userId,
        sector: 'general',
        use_case: 'free_tier'
      });

      await recordInstallation({
        user_id: userId,
        platform: 'web',
        project_id: `community_${Date.now()}`,
        config_id: 'community_free',
        api_key: apiKey,
        namespace: 'community'
      });

      return c.json({
        success: true,
        api_key: apiKey,
        namespace: 'community',
        plan: 'free',
        tier: 'free',
        rate_limit: 10_000,
        provisioned_at: new Date().toISOString(),
        email,
        usage: {
          endpoint: 'https://agentcache.ai/api',
          docs: 'https://agentcache.ai/docs'
        },
        quick_start: {
          install: 'npm install agentcache-sdk',
          code: `const cache = require('agentcache-sdk');\ncache.init({ apiKey: '${apiKey}' });`
        }
      }, 201);
    }

    // Validate required fields for standard provisioning
    if (!user_id || !integration || !project_id) {
      return c.json({
        error: 'Missing required fields',
        required: ['user_id', 'integration', 'project_id']
      }, 400);
    }

    // Validate integration name (alphanumeric + underscore/dash only)
    if (!/^[a-zA-Z0-9_-]+$/.test(integration)) {
      return c.json({
        error: 'Invalid integration name. Use only alphanumeric characters, underscores, and dashes.'
      }, 400);
    }

    // Set rate limit based on tier if not specified
    const effectiveRateLimit = rate_limit || getRateLimitForTier(tier);

    // Generate API key
    const apiKey = await generateApiKey({
      user_id,
      integration,
      project_id
    });

    // Create default namespace
    const namespace = `${integration}_${project_id}`;
    await createNamespace({
      name: namespace,
      user_id,
      sector,
      use_case
    });

    // Record the installation
    await recordInstallation({
      user_id,
      platform: 'manual',
      project_id,
      config_id: `${integration}_config`,
      api_key: apiKey,
      namespace
    });

    // Return provisioning details
    return c.json({
      success: true,
      api_key: apiKey,
      namespace,
      rate_limit: effectiveRateLimit,
      tier,
      provisioned_at: new Date().toISOString(),
      usage: {
        endpoint: process.env.PUBLIC_URL || 'https://api.agentcache.ai',
        documentation: `${process.env.PUBLIC_URL || 'https://api.agentcache.ai'}/docs`
      },
      next_steps: [
        'Store API key securely in environment variables',
        'Implement namespace isolation per customer',
        'Monitor cache hit rates in dashboard',
        'Contact support for production optimization'
      ]
    }, 201);

  } catch (error) {
    console.error('[Provision API] Error:', error);
    return c.json({
      error: 'Failed to provision client',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}

/**
 * GET /api/provision/:api_key
 * Get information about an API key
 */
export async function getApiKeyInfo(c: Context) {
  try {
    const api_key = c.req.param('api_key');

    const keyInfo = await validateApiKey(api_key);

    if (!keyInfo) {
      return c.json({
        error: 'API key not found'
      }, 404);
    }

    // Return sanitized key info (don't expose full key)
    return c.json({
      success: true,
      key_info: {
        user_id: keyInfo.user_id,
        integration: keyInfo.integration,
        project_id: keyInfo.project_id,
        rate_limit: keyInfo.rate_limit,
        usage_count: keyInfo.usage_count,
        created_at: keyInfo.created_at,
        key_preview: `${api_key.substring(0, 20)}...${api_key.substring(api_key.length - 4)}`
      }
    });

  } catch (error) {
    console.error('[Provision API] Error:', error);
    return c.json({
      error: 'Failed to retrieve key info',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}

/**
 * POST /api/provision/jettythunder
 * Quick provision endpoint specifically for JettyThunder
 */
export async function provisionJettyThunder(c: Context) {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { environment = 'production' } = body;

    // Generate master key for JettyThunder
    const apiKey = await generateApiKey({
      user_id: 'jettythunder_master',
      integration: 'jettythunder',
      project_id: `jettythunder-${environment}`
    });

    // Create namespace
    const namespace = `jettythunder_${environment}`;
    await createNamespace({
      name: namespace,
      user_id: 'jettythunder_master',
      sector: 'filestorage',
      use_case: 'cdn_acceleration'
    });

    // Record installation
    await recordInstallation({
      user_id: 'jettythunder_master',
      platform: 'manual',
      project_id: `jettythunder-${environment}`,
      config_id: 'jettythunder_enterprise_config',
      api_key: apiKey,
      namespace
    });

    return c.json({
      success: true,
      message: 'JettyThunder master key provisioned successfully',
      api_key: apiKey,
      namespace,
      environment,
      rate_limit: 10_000_000, // 10M requests/month (enterprise tier)
      tier: 'enterprise',
      provisioned_at: new Date().toISOString(),
      integration_guide: {
        env_vars: {
          AGENTCACHE_API_KEY: apiKey,
          AGENTCACHE_API_URL: process.env.PUBLIC_URL || 'https://api.agentcache.ai'
        },
        namespace_pattern: 'jt_customer_${customerId}',
        sample_code: `
// src/lib/edge-cdn.ts
import { AgentCache } from 'agentcache-client';

const agentCache = new AgentCache({
  apiKey: process.env.AGENTCACHE_API_KEY,
  baseUrl: process.env.AGENTCACHE_API_URL
});

export async function cacheFile(file: File, customerId: string) {
  return agentCache.set({
    provider: 'jettythunder',
    model: 'file-delivery',
    messages: [{ role: 'system', content: \`file:\${file.id}\` }],
    response: file.url,
    namespace: \`jt_customer_\${customerId}\`,
    ttl: 86400 // 24 hours
  });
}
        `.trim()
      },
      next_steps: [
        '1. Add AGENTCACHE_API_KEY to Vercel environment variables',
        '2. Update edge-cdn.ts to use AgentCache client',
        '3. Implement namespace isolation per customer',
        '4. Test with staging environment first',
        '5. Monitor cache hit rates and performance',
        '6. Contact support@agentcache.ai for optimization'
      ],
      support: {
        email: 'support@agentcache.ai',
        docs: `${process.env.PUBLIC_URL || 'https://api.agentcache.ai'}/docs/jettythunder`,
        slack: '#jettythunder-integration'
      }
    }, 201);

  } catch (error) {
    console.error('[JettyThunder Provision] Error:', error);
    return c.json({
      error: 'Failed to provision JettyThunder',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}

/**
 * Helper: Get rate limit based on tier
 */
function getRateLimitForTier(tier: string): number {
  const limits: Record<string, number> = {
    free: 10_000,        // 10k/month
    pro: 100_000,        // 100k/month
    enterprise: 10_000_000  // 10M/month
  };
  return limits[tier] || limits.free;
}
