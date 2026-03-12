/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
const PLAN_METADATA = {
  free: {
    publicId: 'free',
    displayName: 'Solo Pilot',
    quota: 10_000,
    upgradePlan: 'pro',
    upgradeUrl: '/pricing.html',
  },
  pro: {
    publicId: 'pro',
    displayName: 'Swarm Fleet',
    quota: 1_000_000,
    upgradePlan: 'enterprise',
    upgradeUrl: '/pricing.html',
  },
  enterprise: {
    publicId: 'enterprise',
    displayName: 'Cognitive Cluster',
    quota: 10_000_000,
    upgradePlan: null,
    upgradeUrl: '/pricing.html',
  },
};

export function normalizePublicPlanId(plan = 'free') {
  const value = String(plan || 'free').toLowerCase();

  if (value === 'free') {
    return 'free';
  }

  if (value === 'pro') {
    return 'pro';
  }

  if (value === 'starter') {
    return 'free';
  }

  if (value === 'professional') {
    return 'pro';
  }

  if (value === 'business') {
    return 'pro';
  }

  if (value === 'enterprise') {
    return 'enterprise';
  }

  return 'free';
}

export function getPlanMetadata(plan = 'free') {
  const publicId = normalizePublicPlanId(plan);
  return PLAN_METADATA[publicId] || PLAN_METADATA.free;
}

export function getDefaultQuotaForPlan(plan = 'free') {
  return getPlanMetadata(plan).quota;
}

export function getUpgradeDetails(plan = 'free') {
  const currentPlan = getPlanMetadata(plan);
  const recommendedPlan = currentPlan.upgradePlan
    ? getPlanMetadata(currentPlan.upgradePlan)
    : null;

  return {
    currentPlan: currentPlan.publicId,
    currentPlanDisplay: currentPlan.displayName,
    recommendedPlan: recommendedPlan?.publicId || null,
    recommendedPlanDisplay: recommendedPlan?.displayName || null,
    upgradeRequired: Boolean(recommendedPlan),
    upgradeUrl: recommendedPlan
      ? `/upgrade.html?plan=${recommendedPlan.publicId}`
      : currentPlan.upgradeUrl,
    contactUrl: 'mailto:sales@agentcache.ai',
  };
}

export function buildQuotaExceededPayload({
  currentPlan = 'free',
  used = 0,
  quota = null,
  limitType = 'requests',
}) {
  const details = getUpgradeDetails(currentPlan);
  const resolvedQuota = quota ?? getDefaultQuotaForPlan(currentPlan);

  let message = `This workspace has used ${used.toLocaleString('en-US')} of ${resolvedQuota.toLocaleString('en-US')} monthly ${limitType}.`;

  if (details.recommendedPlan === 'pro') {
    message += ' Upgrade to Pro for 1M requests per month.';
  } else if (details.recommendedPlan === 'enterprise') {
    message += ' Upgrade to Enterprise for 10M requests per month plus Guardrails and Knowledge.';
  } else {
    message += ' Contact sales to raise enterprise limits.';
  }

  return {
    error: 'Monthly quota exceeded',
    code: 'MONTHLY_QUOTA_EXCEEDED',
    used,
    quota: resolvedQuota,
    remaining: 0,
    limitType,
    ...details,
    message,
  };
}

export function buildRateLimitPayload({
  currentPlan = 'free',
  limit,
  window = '1 minute',
}) {
  const details = getUpgradeDetails(currentPlan);

  let message = `${details.currentPlanDisplay} requests are capped at ${limit} per ${window}.`;

  if (details.recommendedPlan === 'pro') {
    message += ' Upgrade to Pro for more burst capacity and a larger monthly quota.';
  } else if (details.recommendedPlan === 'enterprise') {
    message += ' Upgrade to Enterprise for the highest self-serve throughput.';
  } else {
    message += ' Contact sales if you need a custom enterprise throughput profile.';
  }

  return {
    error: 'Rate limit exceeded',
    code: 'RATE_LIMIT_EXCEEDED',
    limit,
    window,
    ...details,
    message,
  };
}
