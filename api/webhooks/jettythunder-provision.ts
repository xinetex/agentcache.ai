import { Redis } from '@upstash/redis';

export const config = {
  runtime: 'nodejs',
};

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

interface ProvisionRequest {
  user_id: string;
  email: string;
  tier: 'free' | 'starter' | 'pro' | 'business' | 'enterprise';
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Verify internal webhook secret
    const authHeader = req.headers.get('Authorization');
    const expectedSecret = process.env.INTERNAL_WEBHOOK_SECRET || 'change_me_in_production';
    
    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== expectedSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json() as ProvisionRequest;

    if (!body.user_id || !body.email || !body.tier) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: user_id, email, tier' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if already provisioned
    const cacheKey = `jetty:provisioned:${body.user_id}`;
    const existing = await redis.get(cacheKey);
    
    if (existing) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Account already provisioned',
        cached: true,
        credentials: existing,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Call JettyThunder provisioning endpoint
    const jettyThunderUrl = process.env.JETTYTHUNDER_API_URL || 'http://localhost:3001';
    const jettyThunderSecret = process.env.JETTYTHUNDER_WEBHOOK_SECRET || 'jetty_webhook_secret_123';

    const provisionResponse = await fetch(`${jettyThunderUrl}/api/agentcache/provision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jettyThunderSecret}`,
      },
      body: JSON.stringify({
        agentcache_user_id: body.user_id,
        agentcache_email: body.email,
        tier: body.tier,
      }),
    });

    if (!provisionResponse.ok) {
      const errorData = await provisionResponse.json().catch(() => ({}));
      throw new Error(`JettyThunder provisioning failed: ${provisionResponse.status} - ${JSON.stringify(errorData)}`);
    }

    const jettyData = await provisionResponse.json();

    if (!jettyData.success || !jettyData.account) {
      throw new Error('Invalid response from JettyThunder');
    }

    // Cache credentials in Redis (30 days)
    const credentials = {
      api_key: jettyData.account.api_key,
      api_secret: jettyData.account.api_secret,
      storage_quota_gb: jettyData.account.storage_quota_gb,
      jetty_speed_enabled: jettyData.account.jetty_speed_enabled,
      s3_bucket: jettyData.account.s3_bucket,
      s3_prefix: jettyData.account.s3_prefix,
      provisioned_at: new Date().toISOString(),
    };

    await redis.set(cacheKey, JSON.stringify(credentials), {
      ex: 60 * 60 * 24 * 30, // 30 days
    });

    // Also cache by API key for quick lookup
    await redis.set(`jetty:apikey:${jettyData.account.api_key}`, body.user_id, {
      ex: 60 * 60 * 24 * 30,
    });

    console.log(`✅ Provisioned JettyThunder storage for user ${body.user_id} (${body.tier})`);

    return new Response(JSON.stringify({
      success: true,
      message: 'JettyThunder storage account created',
      credentials: credentials,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('JettyThunder provisioning error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to provision storage account',
      details: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
