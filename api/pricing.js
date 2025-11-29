/**
 * GET /api/pricing
 * Returns all pricing tiers (public endpoint - no auth required)
 */

export const config = {
  runtime: 'edge',
};

// Tier definitions (must match src/config/tiers.ts)
const TIERS = {
  FREE: {
    id: 'free',
    name: 'Community',
    price: 0,
    quota: 10_000,
    features: {
      namespaces: 1,
      ttlMaxDays: 7,
      pipelineNodes: 3,
      privateNamespace: false,
      analytics: 'basic',
      support: 'community'
    }
  },
  PRO: {
    id: 'pro',
    name: 'Pro',
    price: 49,
    quota: 1_000_000,
    features: {
      namespaces: 10,
      ttlMaxDays: 90,
      pipelineNodes: 20,
      privateNamespace: true,
      analytics: 'advanced',
      support: 'priority'
    }
  },
  ENTERPRISE: {
    id: 'enterprise',
    name: 'Enterprise',
    price: null,
    quota: -1,
    features: {
      namespaces: -1,
      ttlMaxDays: 'unlimited',
      pipelineNodes: -1,
      privateNamespace: true,
      analytics: 'custom',
      support: 'dedicated'
    }
  }
};

export default async function handler(req) {
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  const tiers = Object.values(TIERS);

  return new Response(
    JSON.stringify({ tiers }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      }
    }
  );
}
