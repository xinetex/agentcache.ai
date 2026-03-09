import {
  compareInternalPlans,
  normalizeInternalPlanTier,
} from './billing-plans.js';

const BILLING_ADDONS = {
  guardrails: {
    id: 'guardrails',
    name: 'Guardrails',
    featureKey: 'guardrails',
    description: 'Prompt injection, secret leakage, and policy enforcement for agent input before execution.',
    monthlyPrice: 99,
    yearlyPrice: 990,
    requiredPlan: 'professional',
    includedPlans: ['enterprise'],
    stripeMonthlyPriceId:
      process.env.STRIPE_PRICE_GUARDRAILS_MONTHLY ||
      process.env.STRIPE_PRICE_GUARDRAILS ||
      'price_guardrails_monthly',
    stripeYearlyPriceId:
      process.env.STRIPE_PRICE_GUARDRAILS_YEARLY ||
      'price_guardrails_yearly',
    highlights: [
      'PII, secret, and policy validation',
      'Prompt injection and jailbreak checks',
      'Pre-execution safety control for workflows',
    ],
  },
  knowledge: {
    id: 'knowledge',
    name: 'Knowledge',
    featureKey: 'knowledge',
    description: 'Documentation ingest, semantic search, and retrieval-ready workspace memory.',
    monthlyPrice: 99,
    yearlyPrice: 990,
    requiredPlan: 'professional',
    includedPlans: ['enterprise'],
    stripeMonthlyPriceId:
      process.env.STRIPE_PRICE_KNOWLEDGE_MONTHLY ||
      process.env.STRIPE_PRICE_KNOWLEDGE ||
      'price_knowledge_monthly',
    stripeYearlyPriceId:
      process.env.STRIPE_PRICE_KNOWLEDGE_YEARLY ||
      'price_knowledge_yearly',
    highlights: [
      'Docs ingest and chunking pipeline',
      'Semantic search across workspace knowledge',
      'Reusable retrieval memory for agents',
    ],
  },
};

const PLACEHOLDER_PRICE_IDS = new Set([
  'price_guardrails_monthly',
  'price_guardrails_yearly',
  'price_knowledge_monthly',
  'price_knowledge_yearly',
]);

export function getBillingAddons() {
  return Object.values(BILLING_ADDONS).map((addon) => ({ ...addon }));
}

export function getBillingAddonById(addonId) {
  if (!addonId) {
    return null;
  }

  return BILLING_ADDONS[String(addonId).toLowerCase()] || null;
}

export function getBillingAddonByStripePriceId(priceId) {
  if (!priceId) {
    return null;
  }

  return (
    Object.values(BILLING_ADDONS).find((addon) => (
      addon.stripeMonthlyPriceId === priceId || addon.stripeYearlyPriceId === priceId
    )) || null
  );
}

export function getAddonStripePriceId(addonId, billingPeriod = 'monthly') {
  const addon = getBillingAddonById(addonId);
  if (!addon) {
    return null;
  }

  return billingPeriod === 'yearly'
    ? addon.stripeYearlyPriceId || addon.stripeMonthlyPriceId
    : addon.stripeMonthlyPriceId;
}

export function isPlaceholderAddonStripePriceId(priceId) {
  return PLACEHOLDER_PRICE_IDS.has(priceId);
}

export function isAddonIncludedInPlan(addonId, planTier = 'starter') {
  const addon = getBillingAddonById(addonId);
  if (!addon) {
    return false;
  }

  const normalizedPlan = normalizeInternalPlanTier(planTier);
  return addon.includedPlans.includes(normalizedPlan);
}

export function canPlanPurchaseAddon(addonId, planTier = 'starter') {
  const addon = getBillingAddonById(addonId);
  if (!addon) {
    return false;
  }

  const normalizedPlan = normalizeInternalPlanTier(planTier);

  if (isAddonIncludedInPlan(addonId, normalizedPlan)) {
    return true;
  }

  return compareInternalPlans(normalizedPlan, addon.requiredPlan) >= 0;
}

export function getIncludedAddonsForPlan(planTier = 'starter') {
  const normalizedPlan = normalizeInternalPlanTier(planTier);
  return getBillingAddons()
    .filter((addon) => addon.includedPlans.includes(normalizedPlan))
    .map((addon) => addon.id);
}

export function getAddonCheckoutUrl(addonId) {
  const addon = getBillingAddonById(addonId);
  return addon ? `/addons.html?addon=${addon.id}` : '/pricing.html';
}
