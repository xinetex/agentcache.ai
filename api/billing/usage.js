export const config = { runtime: 'nodejs' };

import { query } from '../../lib/db.js';
import { requireAuth, withAuth } from '../../lib/auth-middleware.js';
import {
  getBillingPlanByInternalTier,
  getPlanLimitsSnapshot,
  getPublicPlanIdFromInternalTier,
  getQuotaForInternalPlan,
  getUpgradeTargetForInternalPlan,
  normalizeInternalPlanTier,
} from '../../lib/billing-plans.js';
import {
  canPlanPurchaseAddon,
  getAddonCheckoutUrl,
  getBillingAddons,
  isAddonIncludedInPlan,
} from '../../lib/billing-addons.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'Content-Type, Authorization',
    },
  });
}

function toInteger(value) {
  return Number.parseInt(value || '0', 10) || 0;
}

function toNumber(value) {
  return Number.parseFloat(value || '0') || 0;
}

function getCurrentMonthWindow(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

async function handleRequest(req) {
  if (req.method === 'OPTIONS') {
    return json({ ok: true });
  }

  if (req.method !== 'GET') {
    return json({ success: false, error: 'Method not allowed' }, 405);
  }

  const user = await requireAuth(req);

  if (!user.organizationId) {
    return json({
      success: false,
      error: 'Organization setup required',
      onboardingRequired: true,
      onboardingUrl: '/onboarding.html',
    }, 409);
  }

  const organizationResult = await query(`
    SELECT
      id,
      name,
      slug,
      sector,
      plan_tier,
      status,
      max_namespaces,
      max_api_keys,
      max_users,
      stripe_customer_id,
      stripe_subscription_id,
      created_at
    FROM organizations
    WHERE id = $1
    LIMIT 1
  `, [user.organizationId]);

  if (organizationResult.rows.length === 0) {
    return json({ success: false, error: 'Organization not found' }, 404);
  }

  const organization = organizationResult.rows[0];

  const [
    subscriptionResult,
    usageResult,
    namespaceCountResult,
    apiKeyCountResult,
    pipelineCountResult,
    userCountResult,
    settingsResult,
  ] = await Promise.all([
    query(`
      SELECT
        s.plan_tier,
        s.status,
        s.current_period_start,
        s.current_period_end,
        s.cancel_at_period_end,
        s.stripe_subscription_id
      FROM subscriptions s
      JOIN users u ON u.id = s.user_id
      WHERE u.organization_id = $1
      ORDER BY
        CASE
          WHEN s.status = 'active' THEN 0
          WHEN s.status = 'trialing' THEN 1
          WHEN s.status = 'past_due' THEN 2
          ELSE 3
        END,
        s.updated_at DESC,
        s.created_at DESC
      LIMIT 1
    `, [user.organizationId]),
    query(`
      SELECT
        COALESCE(SUM(cache_requests), 0) AS requests_this_month,
        COALESCE(SUM(cache_hits), 0) AS cache_hits,
        COALESCE(SUM(cache_misses), 0) AS cache_misses,
        COALESCE(SUM(cost_saved), 0) AS cost_saved
      FROM organization_usage_metrics
      WHERE organization_id = $1
        AND date >= DATE_TRUNC('month', CURRENT_DATE)
        AND date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
    `, [user.organizationId]),
    query(
      'SELECT COUNT(*) AS count FROM namespaces WHERE organization_id = $1 AND is_active = true',
      [user.organizationId]
    ),
    query(
      'SELECT COUNT(*) AS count FROM api_keys WHERE organization_id = $1 AND is_active = true',
      [user.organizationId]
    ),
    query(
      `SELECT COUNT(*) AS count
       FROM pipelines
       WHERE organization_id = $1
         AND status != 'archived'`,
      [user.organizationId]
    ),
    query(
      'SELECT COUNT(*) AS count FROM users WHERE organization_id = $1 AND is_active = true',
      [user.organizationId]
    ),
    query(
      'SELECT features, preferences FROM organization_settings WHERE organization_id = $1 LIMIT 1',
      [user.organizationId]
    ),
  ]);

  const subscription = subscriptionResult.rows[0] || null;
  const settings = settingsResult.rows[0] || {};
  const organizationFeatures = settings.features || {};
  const organizationPreferences = settings.preferences || {};
  const addonPreferences = organizationPreferences.addons || {};
  const internalPlan = normalizeInternalPlanTier(
    organization.plan_tier || subscription?.plan_tier || 'starter'
  );
  const publicPlan = getPublicPlanIdFromInternalTier(internalPlan);
  const publicPlanDef = getBillingPlanByInternalTier(internalPlan);
  const currentPlanLimits = getPlanLimitsSnapshot(internalPlan);
  const quota = getQuotaForInternalPlan(internalPlan);
  const upgradeTarget = getUpgradeTargetForInternalPlan(internalPlan);

  const usageRow = usageResult.rows[0] || {};
  const requestsThisMonth = toInteger(usageRow.requests_this_month);
  const cacheHits = toInteger(usageRow.cache_hits);
  const cacheMisses = toInteger(usageRow.cache_misses);
  const costSaved = Math.round(toNumber(usageRow.cost_saved));
  const hitRate = requestsThisMonth > 0
    ? Math.round((cacheHits / requestsThisMonth) * 100)
    : 0;
  const remaining = Math.max(quota - requestsThisMonth, 0);
  const percentUsed = quota > 0
    ? Math.min(100, Math.round((requestsThisMonth / quota) * 100))
    : 0;

  const { start, end } = getCurrentMonthWindow();
  const msRemaining = end.getTime() - Date.now();
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));

  const namespaceCount = toInteger(namespaceCountResult.rows[0]?.count);
  const apiKeyCount = toInteger(apiKeyCountResult.rows[0]?.count);
  const pipelineCount = toInteger(pipelineCountResult.rows[0]?.count);
  const userCount = toInteger(userCountResult.rows[0]?.count);
  const addons = getBillingAddons().map((addon) => {
    const storedAddonState = addonPreferences[addon.id] || {};
    const included = isAddonIncludedInPlan(addon.id, internalPlan);
    const active = included || Boolean(organizationFeatures[addon.featureKey]) || Boolean(storedAddonState.active);
    const canPurchase = canPlanPurchaseAddon(addon.id, internalPlan);
    const upgradeRequired = !canPurchase && !included;
    const status = included
      ? 'included'
      : active
        ? 'active'
        : upgradeRequired
          ? 'upgrade_required'
          : 'available';

    return {
      id: addon.id,
      name: addon.name,
      description: addon.description,
      monthlyPrice: addon.monthlyPrice,
      yearlyPrice: addon.yearlyPrice,
      highlights: addon.highlights,
      included,
      active,
      status,
      source: included ? 'plan' : storedAddonState.source || null,
      upgradeRequired,
      upgradeUrl: upgradeRequired
        ? '/upgrade.html?plan=pro'
        : getAddonCheckoutUrl(addon.id),
      checkoutUrl: getAddonCheckoutUrl(addon.id),
      requiredPlan: addon.requiredPlan,
      usageSummary: active
        ? storedAddonState.usageSummary || 'Activation is live for this workspace.'
        : upgradeRequired
          ? 'Upgrade to Pro or Enterprise before enabling this add-on.'
          : 'Ready to activate for this workspace.',
      updatedAt: storedAddonState.updatedAt || null,
    };
  });

  return json({
    success: true,
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      sector: organization.sector,
      status: organization.status,
      createdAt: organization.created_at,
    },
    subscription: {
      plan: internalPlan,
      publicPlan,
      displayPlan: publicPlanDef?.name || 'Free',
      status: subscription?.status || 'active',
      stripeCustomerId: organization.stripe_customer_id || null,
      stripeSubscriptionId:
        organization.stripe_subscription_id ||
        subscription?.stripe_subscription_id ||
        null,
      currentPeriodStart: subscription?.current_period_start || start.toISOString(),
      currentPeriodEnd: subscription?.current_period_end || end.toISOString(),
      cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
    },
    usage: {
      requestsThisMonth,
      quota,
      remaining,
      percentUsed,
      cacheHits,
      cacheMisses,
      hitRate,
      costSaved,
    },
    billingCycle: {
      start: start.toISOString(),
      end: end.toISOString(),
      daysRemaining,
    },
    resources: {
      namespaces: {
        used: namespaceCount,
        limit: organization.max_namespaces || currentPlanLimits.maxNamespaces,
      },
      apiKeys: {
        used: apiKeyCount,
        limit: organization.max_api_keys || currentPlanLimits.maxApiKeys,
      },
      users: {
        used: userCount,
        limit: organization.max_users || currentPlanLimits.maxUsers,
      },
      pipelines: {
        used: pipelineCount,
        limit: null,
      },
    },
    addons,
    recommendations: {
      upgradeTarget: upgradeTarget
        ? {
            publicId: upgradeTarget.publicId,
            internalId: upgradeTarget.internalId,
            name: upgradeTarget.name,
            monthlyPrice: upgradeTarget.monthlyPrice,
            yearlyPrice: upgradeTarget.yearlyPrice,
            quota: upgradeTarget.quota,
            limits: getPlanLimitsSnapshot(upgradeTarget.internalId),
            upgradeUrl: `/upgrade.html?plan=${upgradeTarget.publicId}`,
          }
        : null,
    },
  });
}

export default withAuth(handleRequest);
