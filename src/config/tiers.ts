/**
 * Tier Configuration - Single Source of Truth
 * 
 * All pricing, quotas, and feature flags are defined here.
 * Used across backend (enforcement) and frontend (pricing pages).
 */

export interface TierFeatures {
  cacheTypes: string[] | 'all';
  namespaces: number; // -1 = unlimited
  ttlMax: number; // milliseconds, -1 = unlimited
  analytics: 'basic' | 'advanced' | 'custom';
  support: 'community' | 'priority' | 'dedicated';
  antiCache: boolean;
  overflow: boolean;
  pipelineNodes: number; // -1 = unlimited
  customNodes: boolean;
  privateNamespace: boolean;
  sso?: boolean;
  onPremise?: boolean;
}

export interface Tier {
  id: string;
  name: string;
  price: number | null; // null = custom pricing
  quota: number; // requests/month, -1 = unlimited
  stripeMonthlyPriceId?: string;
  stripeYearlyPriceId?: string;
  features: TierFeatures;
}

export const TIERS: Record<string, Tier> = {
  FREE: {
    id: 'free',
    name: 'Community',
    price: 0,
    quota: 10_000, // 10K requests/month
    features: {
      cacheTypes: ['llm', 'tool', 'db', 'embedding'],
      namespaces: 1, // shared 'community' namespace only
      ttlMax: 7 * 24 * 60 * 60 * 1000, // 7 days
      analytics: 'basic',
      support: 'community',
      antiCache: true,
      overflow: true,
      pipelineNodes: 3, // max 3 nodes per pipeline
      customNodes: false,
      privateNamespace: false
    }
  },
  PRO: {
    id: 'pro',
    name: 'Pro',
    price: 49, // $49/month
    quota: 1_000_000, // 1M requests/month
    stripeMonthlyPriceId: process.env.STRIPE_PRICE_PRO_MONTHLY || 'price_pro_monthly',
    stripeYearlyPriceId: process.env.STRIPE_PRICE_PRO_YEARLY || 'price_pro_yearly',
    features: {
      cacheTypes: ['llm', 'tool', 'db', 'embedding', 'semantic'],
      namespaces: 10,
      ttlMax: 90 * 24 * 60 * 60 * 1000, // 90 days
      analytics: 'advanced',
      support: 'priority',
      antiCache: true,
      overflow: true,
      pipelineNodes: 20, // max 20 nodes per pipeline
      customNodes: false,
      privateNamespace: true
    }
  },
  ENTERPRISE: {
    id: 'enterprise',
    name: 'Enterprise',
    price: null, // Custom pricing
    quota: -1, // Unlimited
    features: {
      cacheTypes: 'all',
      namespaces: -1, // Unlimited
      ttlMax: -1, // Unlimited
      analytics: 'custom',
      support: 'dedicated',
      antiCache: true,
      overflow: true,
      pipelineNodes: -1, // Unlimited
      customNodes: true,
      privateNamespace: true,
      sso: true,
      onPremise: true
    }
  }
};

// Helper to get tier by ID (case-insensitive)
export function getTier(tierId: string): Tier | null {
  const normalized = tierId.toUpperCase();
  return TIERS[normalized] || null;
}

// Helper to get quota for a tier
export function getTierQuota(tierId: string): number {
  const tier = getTier(tierId);
  return tier?.quota || 10_000; // default to free tier
}

// Helper to get all tiers as array
export function getAllTiers(): Tier[] {
  return Object.values(TIERS);
}
