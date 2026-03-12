/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
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
  agentSlots: number; // New metric: Max active agents in swarm
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
    name: 'Solo Pilot',
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
      pipelineNodes: 3, 
      customNodes: false,
      privateNamespace: false,
      agentSlots: 3
    }
  },
  PRO: {
    id: 'pro',
    name: 'Swarm Fleet',
    price: 99, // $99/month
    quota: 1_000_000, // 1M requests/month
    stripeMonthlyPriceId: process.env.STRIPE_PRICE_PRO_MONTHLY || 'price_1SW7YHAjvdndXr9TfNQ3C8ct',
    stripeYearlyPriceId: process.env.STRIPE_PRICE_PRO_YEARLY || 'price_pro_yearly',
    features: {
      cacheTypes: ['llm', 'tool', 'db', 'embedding', 'semantic'],
      namespaces: 10,
      ttlMax: 90 * 24 * 60 * 60 * 1000, // 90 days
      analytics: 'advanced',
      support: 'priority',
      antiCache: true,
      overflow: true,
      pipelineNodes: 20,
      customNodes: false,
      privateNamespace: true,
      agentSlots: 100
    }
  },
  ENTERPRISE: {
    id: 'enterprise',
    name: 'Cognitive Cluster',
    price: 499, // $499/month
    quota: 10_000_000, // 10M requests/month
    stripeMonthlyPriceId: process.env.STRIPE_PRICE_BUSINESS || 'price_1SW7YHAjvdndXr9TXD41MUq8',
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
      agentSlots: -1, // Unlimited
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

// Helper to get features for a tier
export function getTierFeatures(tierId: string): TierFeatures | null {
  const tier = getTier(tierId);
  return tier?.features || TIERS.FREE.features;
}
