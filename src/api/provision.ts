import { Request, Response } from 'express';
import { generateApiKey, createNamespace, recordInstallation } from '../services/provisioning';

/**
 * POST /api/provision
 * Generate API key for a new client integration
 */
export async function provisionClient(req: Request, res: Response) {
  try {
    const {
      user_id,
      integration,
      project_id,
      tier = 'free',
      rate_limit,
      sector,
      use_case
    } = req.body;

    // Validate required fields
    if (!user_id || !integration || !project_id) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['user_id', 'integration', 'project_id']
      });
    }

    // Validate integration name (alphanumeric + underscore/dash only)
    if (!/^[a-zA-Z0-9_-]+$/.test(integration)) {
      return res.status(400).json({
        error: 'Invalid integration name. Use only alphanumeric characters, underscores, and dashes.'
      });
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
    res.status(201).json({
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
    });

  } catch (error) {
    console.error('[Provision API] Error:', error);
    res.status(500).json({
      error: 'Failed to provision client',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * GET /api/provision/:api_key
 * Get information about an API key
 */
export async function getApiKeyInfo(req: Request, res: Response) {
  try {
    const { api_key } = req.params;

    // Import validateApiKey
    const { validateApiKey } = await import('../services/provisioning');
    const keyInfo = await validateApiKey(api_key);

    if (!keyInfo) {
      return res.status(404).json({
        error: 'API key not found'
      });
    }

    // Return sanitized key info (don't expose full key)
    res.json({
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
    res.status(500).json({
      error: 'Failed to retrieve key info',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * POST /api/provision/jettythunder
 * Quick provision endpoint specifically for JettyThunder
 */
export async function provisionJettyThunder(req: Request, res: Response) {
  try {
    const { environment = 'production' } = req.body;

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

    res.status(201).json({
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
    });

  } catch (error) {
    console.error('[JettyThunder Provision] Error:', error);
    res.status(500).json({
      error: 'Failed to provision JettyThunder',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
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
