import { getPlanLimits } from './workspace-provisioning.js';

const BILLING_PLANS = {
  free: {
    publicId: 'free',
    internalId: 'starter',
    name: 'Free',
    monthlyPrice: 0,
    yearlyPrice: 0,
    quota: 10_000,
    stripeMonthlyPriceId: null,
    stripeYearlyPriceId: null,
  },
  pro: {
    publicId: 'pro',
    internalId: 'professional',
    name: 'Pro',
    monthlyPrice: 99,
    yearlyPrice: 990,
    quota: 1_000_000,
    stripeMonthlyPriceId:
      process.env.STRIPE_PRICE_PRO_MONTHLY ||
      process.env.STRIPE_PRICE_PROFESSIONAL ||
      process.env.STRIPE_PRICE_PRO ||
      'price_pro_monthly',
    stripeYearlyPriceId:
      process.env.STRIPE_PRICE_PRO_YEARLY ||
      process.env.STRIPE_PRICE_PROFESSIONAL_YEARLY ||
      'price_pro_yearly',
  },
  enterprise: {
    publicId: 'enterprise',
    internalId: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 299,
    yearlyPrice: 2990,
    quota: 10_000_000,
    stripeMonthlyPriceId:
      process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY ||
      process.env.STRIPE_PRICE_ENTERPRISE ||
      'price_enterprise_monthly',
    stripeYearlyPriceId:
      process.env.STRIPE_PRICE_ENTERPRISE_YEARLY ||
      'price_enterprise_yearly',
  },
};

const PLAN_ORDER = ['starter', 'professional', 'enterprise'];

export function normalizeInternalPlanTier(planTier = 'starter') {
  const value = String(planTier || 'starter').toLowerCase();

  if (value === 'free') {
    return 'starter';
  }

  if (value === 'pro') {
    return 'professional';
  }

  return value;
}

export function getPublicPlanIdFromInternalTier(planTier = 'starter') {
  const normalized = normalizeInternalPlanTier(planTier);

  if (normalized === 'professional') {
    return 'pro';
  }

  if (normalized === 'enterprise') {
    return 'enterprise';
  }

  return 'free';
}

export function getBillingPlanByPublicId(planId = 'free') {
  const key = String(planId || 'free').toLowerCase();
  return BILLING_PLANS[key] || null;
}

export function getBillingPlanByInternalTier(planTier = 'starter') {
  const publicId = getPublicPlanIdFromInternalTier(planTier);
  return getBillingPlanByPublicId(publicId);
}

export function getBillingPlanByStripePriceId(priceId) {
  if (!priceId) {
    return null;
  }

  return (
    Object.values(BILLING_PLANS).find((plan) => (
      plan.stripeMonthlyPriceId === priceId || plan.stripeYearlyPriceId === priceId
    )) || null
  );
}

export function getStripePriceId(planId, billingPeriod = 'monthly') {
  const plan = getBillingPlanByPublicId(planId);

  if (!plan) {
    return null;
  }

  return billingPeriod === 'yearly'
    ? plan.stripeYearlyPriceId || plan.stripeMonthlyPriceId
    : plan.stripeMonthlyPriceId;
}

export function getQuotaForInternalPlan(planTier = 'starter') {
  const plan = getBillingPlanByInternalTier(planTier);
  return plan?.quota || BILLING_PLANS.free.quota;
}

export function getPlanRank(planTier = 'starter') {
  const normalized = normalizeInternalPlanTier(planTier);
  const index = PLAN_ORDER.indexOf(normalized);
  return index === -1 ? 0 : index;
}

export function compareInternalPlans(leftPlan = 'starter', rightPlan = 'starter') {
  return getPlanRank(leftPlan) - getPlanRank(rightPlan);
}

export function getUpgradeTargetForInternalPlan(planTier = 'starter') {
  const normalized = normalizeInternalPlanTier(planTier);

  if (normalized === 'starter') {
    return getBillingPlanByPublicId('pro');
  }

  if (normalized === 'professional') {
    return getBillingPlanByPublicId('enterprise');
  }

  return null;
}

export function getBillingPlans() {
  return Object.values(BILLING_PLANS).map((plan) => ({
    ...plan,
    limits: getPlanLimits(plan.internalId),
  }));
}

export function getPlanLimitsSnapshot(planTier = 'starter') {
  return getPlanLimits(normalizeInternalPlanTier(planTier));
}

export function isPlaceholderStripePriceId(priceId) {
  return [
    'price_pro_monthly',
    'price_pro_yearly',
    'price_enterprise_monthly',
    'price_enterprise_yearly',
  ].includes(priceId);
}
