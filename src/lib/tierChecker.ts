/**
 * Tier Checker - Feature Access Validation
 * 
 * Utilities to check if a user's tier allows specific features.
 */

import { getTier, type Tier, type TierFeatures } from '../config/tiers.js';

/**
 * Check if a feature is enabled for a given tier
 */
export function canUseFeature(
  tierId: string,
  featureName: keyof TierFeatures
): boolean {
  const tier = getTier(tierId);
  if (!tier) return false;

  const featureValue = tier.features[featureName];

  // Boolean features
  if (typeof featureValue === 'boolean') {
    return featureValue;
  }

  // Numeric features (treat as enabled if > 0 or -1 for unlimited)
  if (typeof featureValue === 'number') {
    return featureValue !== 0;
  }

  // Array features
  if (Array.isArray(featureValue)) {
    return featureValue.length > 0;
  }

  // String features (like 'all' for cacheTypes)
  if (typeof featureValue === 'string') {
    return featureValue !== '';
  }

  return false;
}

/**
 * Get the maximum allowed value for a numeric feature
 */
export function getFeatureLimit(
  tierId: string,
  featureName: keyof TierFeatures
): number {
  const tier = getTier(tierId);
  if (!tier) return 0;

  const featureValue = tier.features[featureName];

  if (typeof featureValue === 'number') {
    return featureValue;
  }

  return 0;
}

/**
 * Check if a namespace is allowed for a given tier
 */
export function canUseNamespace(tierId: string, namespace: string): boolean {
  // Community namespace is always allowed
  if (namespace === 'community') return true;

  // Private namespaces require the feature
  return canUseFeature(tierId, 'privateNamespace');
}

/**
 * Check if a TTL value is within tier limits
 */
export function isTTLAllowed(tierId: string, ttlMs: number): boolean {
  const maxTTL = getFeatureLimit(tierId, 'ttlMax');

  // -1 means unlimited
  if (maxTTL === -1) return true;

  return ttlMs <= maxTTL;
}

/**
 * Check if adding a node to a pipeline is allowed
 */
export function canAddPipelineNode(
  tierId: string,
  currentNodeCount: number
): boolean {
  const maxNodes = getFeatureLimit(tierId, 'pipelineNodes');

  // -1 means unlimited
  if (maxNodes === -1) return true;

  return currentNodeCount < maxNodes;
}

/**
 * Get tier features as a JSON-serializable object
 */
export function getTierFeatures(tierId: string): TierFeatures | null {
  const tier = getTier(tierId);
  return tier?.features || null;
}

/**
 * Get human-readable tier info
 */
export function getTierInfo(tierId: string): {
  name: string;
  quota: number;
  price: number | null;
} | null {
  const tier = getTier(tierId);
  if (!tier) return null;

  return {
    name: tier.name,
    quota: tier.quota,
    price: tier.price
  };
}
