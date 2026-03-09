import Stripe from 'stripe';
import { createHash } from 'crypto';

import { getAuthErrorStatus, requireAuth } from '../../lib/auth-middleware.js';
import { query } from '../../lib/db.js';
import {
  compareInternalPlans,
  getBillingPlanByPublicId,
  getPublicPlanIdFromInternalTier,
  getStripePriceId,
  isPlaceholderStripePriceId,
  normalizeInternalPlanTier,
} from '../../lib/billing-plans.js';
import {
  canPlanPurchaseAddon,
  getAddonCheckoutUrl,
  getAddonStripePriceId,
  getBillingAddonById,
  isAddonIncludedInPlan,
  isPlaceholderAddonStripePriceId,
} from '../../lib/billing-addons.js';

export const config = {
  runtime: 'nodejs',
};

function getHeader(req, name) {
  const value = req.headers?.[name.toLowerCase()] ?? req.headers?.[name];
  return Array.isArray(value) ? value[0] : value;
}

function parseBody(req) {
  if (!req.body) {
    return {};
  }

  if (typeof req.body === 'string') {
    return JSON.parse(req.body);
  }

  return req.body;
}

function getBaseUrl(req) {
  const configured = process.env.PUBLIC_URL;
  if (configured) {
    return configured.replace(/\/$/, '');
  }

  const host = getHeader(req, 'x-forwarded-host') || getHeader(req, 'host');
  const proto = getHeader(req, 'x-forwarded-proto') || 'https';

  if (host) {
    return `${proto}://${host}`;
  }

  return 'https://agentcache.ai';
}

function hashApiKey(apiKey) {
  return createHash('sha256').update(apiKey).digest('hex');
}

function extractAuthorizationToken(req) {
  const authHeader = getHeader(req, 'authorization') || getHeader(req, 'Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.slice('Bearer '.length);
}

async function resolveBillingActor(req) {
  const bearer = extractAuthorizationToken(req);

  if (bearer && !bearer.startsWith('ac_')) {
    const user = await requireAuth(req);

    if (!user.organizationId) {
      const onboardingError = new Error('Organization setup required');
      onboardingError.code = 'ONBOARDING_REQUIRED';
      throw onboardingError;
    }

    const organizationResult = await query(`
      SELECT
        id,
        name,
        slug,
        plan_tier,
        stripe_customer_id,
        stripe_subscription_id,
        contact_email
      FROM organizations
      WHERE id = $1
      LIMIT 1
    `, [user.organizationId]);

    if (organizationResult.rows.length === 0) {
      const orgError = new Error('Organization not found');
      orgError.code = 'ORGANIZATION_NOT_FOUND';
      throw orgError;
    }

    return {
      source: 'portal',
      user,
      organization: organizationResult.rows[0],
    };
  }

  const apiKey = getHeader(req, 'x-api-key') || (bearer && bearer.startsWith('ac_') ? bearer : null);
  if (!apiKey || !apiKey.startsWith('ac_')) {
    const authError = new Error('No authentication token provided');
    authError.code = 'UNAUTHORIZED';
    throw authError;
  }

  const apiKeyHash = hashApiKey(apiKey);
  const result = await query(`
    SELECT
      o.id,
      o.name,
      o.slug,
      o.plan_tier,
      o.stripe_customer_id,
      o.stripe_subscription_id,
      o.contact_email,
      owner.id AS user_id,
      owner.email AS user_email,
      owner.full_name AS user_full_name,
      ak.key_hash
    FROM api_keys ak
    JOIN organizations o ON o.id = ak.organization_id
    LEFT JOIN LATERAL (
      SELECT id, email, full_name
      FROM users
      WHERE organization_id = o.id AND is_active = true
      ORDER BY
        CASE role
          WHEN 'owner' THEN 0
          WHEN 'admin' THEN 1
          ELSE 2
        END,
        created_at ASC
      LIMIT 1
    ) owner ON TRUE
    WHERE ak.key_hash = $1
      AND ak.is_active = true
    LIMIT 1
  `, [apiKeyHash]);

  if (result.rows.length === 0) {
    const keyError = new Error('Invalid or missing API key');
    keyError.code = 'INVALID_API_KEY';
    throw keyError;
  }

  const row = result.rows[0];

  return {
    source: 'api_key',
    user: {
      id: row.user_id || null,
      email: row.user_email || row.contact_email || null,
      full_name: row.user_full_name || null,
      organizationId: row.id,
    },
    organization: {
      id: row.id,
      name: row.name,
      slug: row.slug,
      plan_tier: row.plan_tier,
      stripe_customer_id: row.stripe_customer_id,
      stripe_subscription_id: row.stripe_subscription_id,
      contact_email: row.contact_email,
    },
    apiKeyHash,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = parseBody(req);
    const billingPeriod = body.billingPeriod === 'yearly' ? 'yearly' : 'monthly';
    const addonId = body.addonId ? String(body.addonId).toLowerCase() : null;
    const requestedPlanId = String(body.plan || body.tier || 'pro').toLowerCase();
    const targetPlan = addonId ? null : getBillingPlanByPublicId(requestedPlanId);
    const targetAddon = addonId ? getBillingAddonById(addonId) : null;

    if (!targetAddon && (!targetPlan || targetPlan.publicId === 'free')) {
      return res.status(400).json({
        error: 'Invalid plan selection',
        message: 'Choose Pro or Enterprise for a paid checkout.',
      });
    }

    if (addonId && !targetAddon) {
      return res.status(400).json({
        error: 'Invalid add-on selection',
        message: 'Choose Guardrails or Knowledge for an add-on checkout.',
      });
    }

    const actor = await resolveBillingActor(req);
    const currentPlanTier = normalizeInternalPlanTier(actor.organization.plan_tier || 'starter');
    const publicUrl = getBaseUrl(req);

    if (targetAddon) {
      if (isAddonIncludedInPlan(targetAddon.id, currentPlanTier)) {
        return res.status(409).json({
          error: `${targetAddon.name} is already included in the ${getPublicPlanIdFromInternalTier(currentPlanTier)} plan`,
          currentPlan: currentPlanTier,
          addonId: targetAddon.id,
          included: true,
          upgradeUrl: '/portal-dashboard.html',
        });
      }

      if (!canPlanPurchaseAddon(targetAddon.id, currentPlanTier)) {
        return res.status(409).json({
          error: `${targetAddon.name} requires a Pro or Enterprise workspace`,
          currentPlan: currentPlanTier,
          addonId: targetAddon.id,
          upgradeRequired: true,
          upgradeUrl: '/upgrade.html?plan=pro',
        });
      }

      const settingsResult = await query(
        'SELECT features, preferences FROM organization_settings WHERE organization_id = $1 LIMIT 1',
        [actor.organization.id]
      );
      const settings = settingsResult.rows[0] || {};
      const features = settings.features || {};
      const preferences = settings.preferences || {};
      const addonState = preferences.addons?.[targetAddon.id] || {};

      if (features[targetAddon.featureKey] || addonState.active) {
        if (actor.organization.stripe_customer_id) {
          const stripe = process.env.STRIPE_SECRET_KEY
            ? new Stripe(process.env.STRIPE_SECRET_KEY)
            : null;

          if (stripe) {
            const portalSession = await stripe.billingPortal.sessions.create({
              customer: actor.organization.stripe_customer_id,
              return_url: `${publicUrl}/portal-dashboard.html`,
            });

            return res.status(200).json({
              success: true,
              sessionType: 'billing_portal',
              checkoutUrl: portalSession.url,
              addonId: targetAddon.id,
              message: `${targetAddon.name} is already active for this workspace. Continue in Stripe to manage billing.`,
            });
          }
        }

        return res.status(409).json({
          error: `${targetAddon.name} is already active for this workspace`,
          addonId: targetAddon.id,
          upgradeUrl: getAddonCheckoutUrl(targetAddon.id),
        });
      }

      const addonPriceId = getAddonStripePriceId(targetAddon.id, billingPeriod);
      const successUrl = `${publicUrl}/portal-dashboard.html?billing=success&addon=${targetAddon.id}&session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${publicUrl}/addons.html?addon=${targetAddon.id}&billing=cancel`;

      if (
        !process.env.STRIPE_SECRET_KEY ||
        !addonPriceId ||
        isPlaceholderAddonStripePriceId(addonPriceId)
      ) {
        return res.status(200).json({
          success: true,
          mode: 'simulation',
          checkoutUrl: `${publicUrl}/addons.html?addon=${targetAddon.id}&billing=demo`,
          addonId: targetAddon.id,
          message: 'Stripe is not configured in this environment. The add-on checkout flow is ready but running in demo mode.',
        });
      }

      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const metadata = {
        type: 'addon_purchase',
        organization_id: actor.organization.id,
        user_id: actor.user.id || '',
        addon_id: targetAddon.id,
        current_plan: currentPlanTier,
        current_public_plan: getPublicPlanIdFromInternalTier(currentPlanTier),
        billing_period: billingPeriod,
        source: actor.source,
      };

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        allow_promotion_codes: true,
        billing_address_collection: 'auto',
        line_items: [{ price: addonPriceId, quantity: 1 }],
        customer: actor.organization.stripe_customer_id || undefined,
        customer_email: actor.organization.stripe_customer_id
          ? undefined
          : actor.user.email || actor.organization.contact_email || undefined,
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata,
        subscription_data: {
          metadata,
        },
      });

      return res.status(200).json({
        success: true,
        sessionType: 'checkout',
        checkoutUrl: session.url,
        sessionId: session.id,
        addonId: targetAddon.id,
      });
    }

    if (compareInternalPlans(targetPlan.internalId, currentPlanTier) <= 0) {
      return res.status(409).json({
        error: `Workspace is already on the ${getPublicPlanIdFromInternalTier(currentPlanTier)} plan or higher`,
        currentPlan: currentPlanTier,
        targetPlan: targetPlan.internalId,
        upgradeUrl: '/pricing.html',
      });
    }

    const priceId = getStripePriceId(targetPlan.publicId, billingPeriod);
    const successUrl = `${publicUrl}/portal-dashboard.html?billing=success&plan=${targetPlan.publicId}&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${publicUrl}/upgrade.html?plan=${targetPlan.publicId}&billing=cancel`;

    if (
      !process.env.STRIPE_SECRET_KEY ||
      !priceId ||
      isPlaceholderStripePriceId(priceId)
    ) {
      return res.status(200).json({
        success: true,
        mode: 'simulation',
        checkoutUrl: `${publicUrl}/upgrade.html?plan=${targetPlan.publicId}&billing=demo`,
        currentPlan: currentPlanTier,
        targetPlan: targetPlan.publicId,
        message: 'Stripe is not configured in this environment. The upgrade flow is ready but running in demo mode.',
      });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    if (
      actor.organization.stripe_customer_id &&
      actor.organization.stripe_subscription_id &&
      compareInternalPlans(currentPlanTier, 'starter') > 0
    ) {
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: actor.organization.stripe_customer_id,
        return_url: successUrl,
      });

      return res.status(200).json({
        success: true,
        sessionType: 'billing_portal',
        checkoutUrl: portalSession.url,
        currentPlan: currentPlanTier,
        targetPlan: targetPlan.publicId,
        message: 'This workspace already has an active subscription. Continue in Stripe to manage or upgrade billing.',
      });
    }

    const metadata = {
      type: 'plan_upgrade',
      organization_id: actor.organization.id,
      user_id: actor.user.id || '',
      target_plan: targetPlan.internalId,
      target_public_plan: targetPlan.publicId,
      current_plan: currentPlanTier,
      current_public_plan: getPublicPlanIdFromInternalTier(currentPlanTier),
      billing_period: billingPeriod,
      source: actor.source,
      api_key_hash: actor.apiKeyHash || '',
    };

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      line_items: [{ price: priceId, quantity: 1 }],
      customer: actor.organization.stripe_customer_id || undefined,
      customer_email: actor.organization.stripe_customer_id
        ? undefined
        : actor.user.email || actor.organization.contact_email || undefined,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
      subscription_data: {
        metadata,
      },
    });

    return res.status(200).json({
      success: true,
      sessionType: 'checkout',
      checkoutUrl: session.url,
      sessionId: session.id,
      currentPlan: currentPlanTier,
      targetPlan: targetPlan.publicId,
    });
  } catch (error) {
    if (error?.code === 'ONBOARDING_REQUIRED') {
      return res.status(409).json({
        error: error.message,
        onboardingRequired: true,
        onboardingUrl: '/onboarding.html',
      });
    }

    if (error?.code === 'ORGANIZATION_NOT_FOUND') {
      return res.status(404).json({ error: error.message });
    }

    if (error?.code === 'INVALID_API_KEY') {
      return res.status(401).json({ error: error.message });
    }

    const authStatus = getAuthErrorStatus(error);
    if (authStatus) {
      return res.status(authStatus).json({ error: error.message });
    }

    console.error('[Billing] Create checkout error:', error);
    return res.status(500).json({
      error: 'Failed to create checkout',
      message: error.message,
    });
  }
}
