import Stripe from 'stripe';

import { addCreditsToUser } from '../credits.js';
import { transaction } from '../../lib/db.js';
import { notifier } from '../../src/services/NotificationService.js';
import {
  getBillingPlanByStripePriceId,
  getPlanLimitsSnapshot,
  getPublicPlanIdFromInternalTier,
  getQuotaForInternalPlan,
  normalizeInternalPlanTier,
} from '../../lib/billing-plans.js';
import {
  getBillingAddonById,
  getBillingAddonByStripePriceId,
  getIncludedAddonsForPlan,
  isAddonIncludedInPlan,
} from '../../lib/billing-addons.js';

export const config = {
  runtime: 'nodejs',
  api: {
    bodyParser: false,
  },
};

function getHeader(req, name) {
  const value = req.headers?.[name.toLowerCase()] ?? req.headers?.[name];
  return Array.isArray(value) ? value[0] : value;
}

function json(res, data, status = 200) {
  return res.status(status).json(data);
}

async function readRawBody(req) {
  return await new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function upstashRequest(path) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  const response = await fetch(`${url}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Upstash request failed: ${response.status}`);
  }

  return response;
}

async function upstashSet(key, value) {
  return upstashRequest(`/set/${encodeURIComponent(key)}/${encodeURIComponent(String(value))}`);
}

async function upstashIncrBy(key, amount) {
  const response = await upstashRequest(`/incrby/${encodeURIComponent(key)}/${encodeURIComponent(String(amount))}`);
  return response?.json().catch(() => ({}));
}

async function upstashHSet(key, fields) {
  const parts = [];

  Object.entries(fields).forEach(([field, value]) => {
    parts.push(encodeURIComponent(field));
    parts.push(encodeURIComponent(String(value)));
  });

  return upstashRequest(`/hset/${encodeURIComponent(key)}/${parts.join('/')}`);
}

function toDateFromUnix(timestamp) {
  return timestamp ? new Date(timestamp * 1000) : null;
}

function resolvePlanTierFromSubscription(subscription) {
  const metadataPlan = subscription?.metadata?.target_plan || subscription?.metadata?.plan_tier;
  if (metadataPlan) {
    return normalizeInternalPlanTier(metadataPlan);
  }

  const items = subscription?.items?.data || [];
  for (const item of items) {
    const plan = getBillingPlanByStripePriceId(item.price?.id);
    if (plan) {
      return plan.internalId;
    }
  }

  return null;
}

function extractAddonIdsFromSubscription(subscription) {
  const addonIds = new Set();
  const metadataAddonId = subscription?.metadata?.addon_id;

  if (metadataAddonId && getBillingAddonById(metadataAddonId)) {
    addonIds.add(metadataAddonId);
  }

  const items = subscription?.items?.data || [];
  for (const item of items) {
    const addon = getBillingAddonByStripePriceId(item.price?.id);
    if (addon) {
      addonIds.add(addon.id);
    }
  }

  return Array.from(addonIds);
}

async function ensureOrganizationSettings(client, organizationId) {
  const existing = await client.query(
    'SELECT features, preferences FROM organization_settings WHERE organization_id = $1 LIMIT 1',
    [organizationId]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  const inserted = await client.query(`
    INSERT INTO organization_settings (
      organization_id,
      namespace_strategy,
      features,
      preferences
    ) VALUES ($1, $2, $3::jsonb, $4::jsonb)
    ON CONFLICT (organization_id) DO UPDATE
      SET updated_at = NOW()
    RETURNING features, preferences
  `, [
    organizationId,
    'single_tenant',
    JSON.stringify({
      multi_tenant: false,
      sso: false,
      custom_nodes: false,
    }),
    JSON.stringify({}),
  ]);

  return inserted.rows[0];
}

async function syncIncludedAddonsForPlan(client, organizationId, planTier) {
  const normalizedPlan = normalizeInternalPlanTier(planTier || 'starter');
  const settings = await ensureOrganizationSettings(client, organizationId);
  const features = { ...(settings.features || {}) };
  const preferences = { ...(settings.preferences || {}) };
  const addonPreferences = { ...(preferences.addons || {}) };
  const includedAddons = new Set(getIncludedAddonsForPlan(normalizedPlan));

  ['guardrails', 'knowledge'].forEach((addonId) => {
    const addon = getBillingAddonById(addonId);
    if (!addon) {
      return;
    }

    const currentState = { ...(addonPreferences[addonId] || {}) };

    if (includedAddons.has(addonId)) {
      currentState.active = true;
      currentState.status = 'active';
      currentState.source = 'included';
      currentState.updatedAt = new Date().toISOString();
      features[addon.featureKey] = true;
      addonPreferences[addonId] = currentState;
      return;
    }

    if (currentState.source === 'included') {
      currentState.active = false;
      currentState.status = 'inactive';
      currentState.updatedAt = new Date().toISOString();
      features[addon.featureKey] = false;
      addonPreferences[addonId] = currentState;
    }
  });

  preferences.addons = addonPreferences;

  await client.query(`
    INSERT INTO organization_settings (
      organization_id,
      namespace_strategy,
      features,
      preferences
    ) VALUES ($1, $2, $3::jsonb, $4::jsonb)
    ON CONFLICT (organization_id) DO UPDATE
      SET
        features = EXCLUDED.features,
        preferences = EXCLUDED.preferences,
        updated_at = NOW()
  `, [
    organizationId,
    'single_tenant',
    JSON.stringify(features),
    JSON.stringify(preferences),
  ]);
}

async function persistAddonState({
  organizationId,
  addonIds,
  active,
  source = 'subscription',
  subscriptionId = null,
  customerId = null,
}) {
  if (!organizationId || !Array.isArray(addonIds) || addonIds.length === 0) {
    return;
  }

  await transaction(async (client) => {
    const orgResult = await client.query(
      'SELECT plan_tier FROM organizations WHERE id = $1 LIMIT 1',
      [organizationId]
    );

    if (orgResult.rows.length === 0) {
      return;
    }

    const currentPlan = normalizeInternalPlanTier(orgResult.rows[0].plan_tier || 'starter');
    const settings = await ensureOrganizationSettings(client, organizationId);
    const features = { ...(settings.features || {}) };
    const preferences = { ...(settings.preferences || {}) };
    const addonPreferences = { ...(preferences.addons || {}) };
    const updatedAt = new Date().toISOString();

    addonIds.forEach((addonId) => {
      const addon = getBillingAddonById(addonId);
      if (!addon) {
        return;
      }

      const included = isAddonIncludedInPlan(addonId, currentPlan);
      const nextState = { ...(addonPreferences[addonId] || {}) };

      if (included) {
        nextState.active = true;
        nextState.status = 'active';
        nextState.source = 'included';
      } else if (active) {
        nextState.active = true;
        nextState.status = 'active';
        nextState.source = source;
      } else {
        nextState.active = false;
        nextState.status = 'inactive';
        nextState.source = source;
      }

      if (subscriptionId) {
        nextState.subscriptionId = subscriptionId;
      } else if (!nextState.active && !included) {
        nextState.subscriptionId = null;
      }

      if (customerId) {
        nextState.customerId = customerId;
      }

      nextState.updatedAt = updatedAt;
      addonPreferences[addonId] = nextState;
      features[addon.featureKey] = Boolean(nextState.active);
    });

    preferences.addons = addonPreferences;

    await client.query(`
      INSERT INTO organization_settings (
        organization_id,
        namespace_strategy,
        features,
        preferences
      ) VALUES ($1, $2, $3::jsonb, $4::jsonb)
      ON CONFLICT (organization_id) DO UPDATE
        SET
          features = EXCLUDED.features,
          preferences = EXCLUDED.preferences,
          updated_at = NOW()
    `, [
      organizationId,
      'single_tenant',
      JSON.stringify(features),
      JSON.stringify(preferences),
    ]);
  });
}

async function syncApiKeysForOrganization(client, organizationId, internalPlan, billingState) {
  const publicPlan = getPublicPlanIdFromInternalTier(internalPlan);
  const quota = getQuotaForInternalPlan(internalPlan);
  const subscriptionStatus = billingState.status || (internalPlan === 'starter' ? 'active' : 'active');

  try {
    await client.query(`
      UPDATE api_keys
      SET
        tier = $2,
        stripe_customer_id = $3,
        stripe_subscription_id = $4,
        subscription_status = $5,
        subscription_ends_at = $6
      WHERE organization_id = $1
    `, [
      organizationId,
      publicPlan,
      billingState.customerId || null,
      billingState.subscriptionId || null,
      subscriptionStatus,
      billingState.currentPeriodEnd || null,
    ]);
  } catch (error) {
    console.error('[Billing Webhook] Failed to sync API key billing columns:', error);
  }

  const apiKeysResult = await client.query(`
    SELECT key_hash
    FROM api_keys
    WHERE organization_id = $1
      AND is_active = true
  `, [organizationId]);

  await Promise.all(
    apiKeysResult.rows.map(async (row) => {
      const keyHash = row.key_hash;

      try {
        await Promise.all([
          upstashSet(`tier:${keyHash}`, publicPlan),
          upstashSet(`usage:${keyHash}:quota`, quota),
          upstashSet(`usage:${keyHash}/monthlyQuota`, quota),
          upstashHSet(`usage:${keyHash}`, {
            plan: publicPlan,
            monthlyQuota: quota,
          }),
        ]);
      } catch (error) {
        console.error('[Billing Webhook] Failed to sync Redis billing state:', error);
      }
    })
  );
}

async function findOwnerUserId(client, organizationId, fallbackUserId) {
  if (fallbackUserId) {
    return fallbackUserId;
  }

  const ownerResult = await client.query(`
    SELECT id
    FROM users
    WHERE organization_id = $1
      AND is_active = true
    ORDER BY
      CASE role
        WHEN 'owner' THEN 0
        WHEN 'admin' THEN 1
        ELSE 2
      END,
      created_at ASC
    LIMIT 1
  `, [organizationId]);

  return ownerResult.rows[0]?.id || null;
}

async function persistSubscriptionState({
  organizationId,
  fallbackUserId = null,
  internalPlan,
  customerId = null,
  subscriptionId = null,
  status = 'active',
  currentPeriodStart = null,
  currentPeriodEnd = null,
  cancelAtPeriodEnd = false,
}) {
  const normalizedPlan = normalizeInternalPlanTier(internalPlan || 'starter');
  const limits = getPlanLimitsSnapshot(normalizedPlan);

  await transaction(async (client) => {
    const userId = await findOwnerUserId(client, organizationId, fallbackUserId);

    await client.query(`
      UPDATE organizations
      SET
        plan_tier = $2,
        max_namespaces = $3,
        max_api_keys = $4,
        max_users = $5,
        stripe_customer_id = COALESCE($6, stripe_customer_id),
        stripe_subscription_id = $7,
        status = 'active',
        updated_at = NOW()
      WHERE id = $1
    `, [
      organizationId,
      normalizedPlan,
      limits.maxNamespaces,
      limits.maxApiKeys,
      limits.maxUsers,
      customerId,
      subscriptionId,
    ]);

    if (userId) {
      const existingSubscription = subscriptionId
        ? await client.query(
            'SELECT id FROM subscriptions WHERE stripe_subscription_id = $1 LIMIT 1',
            [subscriptionId]
          )
        : await client.query(
            'SELECT id FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
            [userId]
          );

      const periodStart = currentPeriodStart || new Date();
      const periodEnd = currentPeriodEnd || new Date(Date.now() + (30 * 24 * 60 * 60 * 1000));

      if (existingSubscription.rows.length > 0) {
        await client.query(`
          UPDATE subscriptions
          SET
            user_id = $2,
            stripe_subscription_id = $3,
            plan_tier = $4,
            status = $5,
            current_period_start = $6,
            current_period_end = $7,
            cancel_at_period_end = $8,
            updated_at = NOW()
          WHERE id = $1
        `, [
          existingSubscription.rows[0].id,
          userId,
          subscriptionId,
          normalizedPlan,
          status,
          periodStart,
          periodEnd,
          cancelAtPeriodEnd,
        ]);
      } else {
        await client.query(`
          INSERT INTO subscriptions (
            user_id,
            stripe_subscription_id,
            plan_tier,
            status,
            current_period_start,
            current_period_end,
            cancel_at_period_end
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          userId,
          subscriptionId,
          normalizedPlan,
          status,
          periodStart,
          periodEnd,
          cancelAtPeriodEnd,
        ]);
      }
    }

    await syncApiKeysForOrganization(client, organizationId, normalizedPlan, {
      customerId,
      subscriptionId,
      status,
      currentPeriodEnd,
    });

    await syncIncludedAddonsForPlan(client, organizationId, normalizedPlan);
  });
}

async function findOrganizationForSubscription(client, subscription) {
  const metadataOrganizationId = subscription?.metadata?.organization_id;
  if (metadataOrganizationId) {
    return {
      organizationId: metadataOrganizationId,
      userId: subscription?.metadata?.user_id || null,
    };
  }

  const customerId = typeof subscription?.customer === 'string'
    ? subscription.customer
    : subscription?.customer?.id;

  const result = await client.query(`
    SELECT id
    FROM organizations
    WHERE stripe_subscription_id = $1
       OR stripe_customer_id = $2
    ORDER BY
      CASE
        WHEN stripe_subscription_id = $1 THEN 0
        ELSE 1
      END
    LIMIT 1
  `, [subscription?.id || null, customerId || null]);

  if (result.rows.length === 0) {
    return { organizationId: null, userId: null };
  }

  return {
    organizationId: result.rows[0].id,
    userId: null,
  };
}

async function markSubscriptionStatus(subscriptionId, status) {
  if (!subscriptionId) {
    return;
  }

  await transaction(async (client) => {
    await client.query(`
      UPDATE subscriptions
      SET status = $2, updated_at = NOW()
      WHERE stripe_subscription_id = $1
    `, [subscriptionId, status]);

    await client.query(`
      UPDATE api_keys
      SET subscription_status = $2
      WHERE stripe_subscription_id = $1
    `, [subscriptionId, status]);
  });
}

async function applyLegacyApiKeyUpgrade(keyHash, tier, session) {
  const publicTier = tier === 'enterprise' ? 'enterprise' : 'pro';
  const quota = publicTier === 'enterprise' ? 10_000_000 : 1_000_000;

  try {
    await Promise.all([
      upstashSet(`tier:${keyHash}`, publicTier),
      upstashSet(`usage:${keyHash}:quota`, quota),
      upstashSet(`usage:${keyHash}/monthlyQuota`, quota),
      upstashHSet(`usage:${keyHash}`, {
        plan: publicTier,
        monthlyQuota: quota,
      }),
    ]);
  } catch (error) {
    console.error('[Billing Webhook] Failed to apply legacy API-key upgrade in Redis:', error);
  }

  await transaction(async (client) => {
    try {
      await client.query(`
        UPDATE api_keys
        SET
          tier = $2,
          stripe_customer_id = $3,
          stripe_subscription_id = $4,
          subscription_status = 'active'
        WHERE key_hash = $1
      `, [
        keyHash,
        publicTier,
        session.customer || null,
        session.subscription || null,
      ]);
    } catch (error) {
      console.error('[Billing Webhook] Failed to apply legacy API-key upgrade in Postgres:', error);
    }
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, { error: 'Method not allowed' }, 405);
  }

  try {
    const signature = getHeader(req, 'stripe-signature');
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!signature || !webhookSecret || !process.env.STRIPE_SECRET_KEY) {
      return json(res, { error: 'Missing Stripe configuration' }, 400);
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const rawBody = await readRawBody(req);

    let event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (error) {
      console.error(`[Stripe Webhook] Signature verification failed: ${error.message}`);
      return json(res, { error: `Webhook Error: ${error.message}` }, 400);
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const kind = session.metadata?.type;

        if (kind === 'credit_purchase') {
          const keyHash = session.metadata?.api_key_hash;
          const credits = Number.parseInt(session.metadata?.credits || '0', 10);
          const userId = session.metadata?.user_id;
          const packageId = session.metadata?.package_id;

          if (!keyHash || !Number.isFinite(credits) || credits <= 0) {
            console.error('[Credits Webhook] Missing api_key_hash or credits in metadata');
            break;
          }

          try {
            await upstashIncrBy(`credits:${keyHash}`, credits);
          } catch (error) {
            console.error('[Credits Webhook] Failed to apply credits in Redis:', error);
          }

          if (userId) {
            try {
              await addCreditsToUser(userId, credits, {
                type: 'purchase',
                packageId,
                stripeCheckoutSessionId: session.id,
                stripePaymentIntentId: session.payment_intent,
                description: `Purchased ${credits} credits`,
              });

              await notifier.send(
                userId,
                'success',
                'Credits Purchased',
                `Successfully added ${credits} credits to your account.`,
                '/billing'
              );
            } catch (error) {
              console.error('[Credits Webhook] Failed to persist credits to DB:', error);
            }
          }

          break;
        }

        if (kind === 'plan_upgrade') {
          const organizationId = session.metadata?.organization_id;
          const userId = session.metadata?.user_id || null;
          const fallbackKeyHash = session.metadata?.api_key_hash || null;
          const checkoutSubscriptionId = typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id;
          const subscription = checkoutSubscriptionId
            ? await stripe.subscriptions.retrieve(checkoutSubscriptionId)
            : null;
          const internalPlan = normalizeInternalPlanTier(
            session.metadata?.target_plan ||
            resolvePlanTierFromSubscription(subscription) ||
            'professional'
          );

          if (organizationId) {
            await persistSubscriptionState({
              organizationId,
              fallbackUserId: userId,
              internalPlan,
              customerId: session.customer || subscription?.customer || null,
              subscriptionId: checkoutSubscriptionId,
              status: subscription?.status || 'active',
              currentPeriodStart: toDateFromUnix(subscription?.current_period_start),
              currentPeriodEnd: toDateFromUnix(subscription?.current_period_end),
              cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
            });
          } else if (fallbackKeyHash) {
            await applyLegacyApiKeyUpgrade(fallbackKeyHash, internalPlan, session);
          } else {
            console.warn('[Billing Webhook] Plan checkout missing organization metadata');
          }
        }

        if (kind === 'addon_purchase') {
          const organizationId = session.metadata?.organization_id;
          const addonId = session.metadata?.addon_id;
          const checkoutSubscriptionId = typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id;

          if (organizationId && addonId) {
            await persistAddonState({
              organizationId,
              addonIds: [addonId],
              active: true,
              source: 'subscription',
              subscriptionId: checkoutSubscriptionId,
              customerId: session.customer || null,
            });
          } else {
            console.warn('[Billing Webhook] Add-on checkout missing organization or add-on metadata');
          }
        }

        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const internalPlan = normalizeInternalPlanTier(
          resolvePlanTierFromSubscription(subscription) || 'starter'
        );
        const addonIds = extractAddonIdsFromSubscription(subscription);
        const resolvedPlan = resolvePlanTierFromSubscription(subscription);

        const ownership = await transaction(async (client) => (
          findOrganizationForSubscription(client, subscription)
        ));

        if (!ownership.organizationId) {
          console.warn('[Billing Webhook] No organization found for subscription update', subscription.id);
          break;
        }

        if (resolvedPlan) {
          await persistSubscriptionState({
            organizationId: ownership.organizationId,
            fallbackUserId: ownership.userId,
            internalPlan,
            customerId: typeof subscription.customer === 'string'
              ? subscription.customer
              : subscription.customer?.id || null,
            subscriptionId: subscription.id,
            status: subscription.status || 'active',
            currentPeriodStart: toDateFromUnix(subscription.current_period_start),
            currentPeriodEnd: toDateFromUnix(subscription.current_period_end),
            cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
          });
        }

        if (addonIds.length > 0) {
          await persistAddonState({
            organizationId: ownership.organizationId,
            addonIds,
            active: true,
            source: 'subscription',
            subscriptionId: subscription.id,
            customerId: typeof subscription.customer === 'string'
              ? subscription.customer
              : subscription.customer?.id || null,
          });
        }

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const addonIds = extractAddonIdsFromSubscription(subscription);
        const resolvedPlan = resolvePlanTierFromSubscription(subscription);

        const ownership = await transaction(async (client) => (
          findOrganizationForSubscription(client, subscription)
        ));

        if (!ownership.organizationId) {
          console.warn('[Billing Webhook] No organization found for canceled subscription', subscription.id);
          break;
        }

        if (resolvedPlan) {
          await persistSubscriptionState({
            organizationId: ownership.organizationId,
            fallbackUserId: ownership.userId,
            internalPlan: 'starter',
            customerId: typeof subscription.customer === 'string'
              ? subscription.customer
              : subscription.customer?.id || null,
            subscriptionId: null,
            status: 'canceled',
            currentPeriodStart: toDateFromUnix(subscription.current_period_start),
            currentPeriodEnd: toDateFromUnix(subscription.current_period_end),
            cancelAtPeriodEnd: false,
          });
        }

        if (addonIds.length > 0) {
          await persistAddonState({
            organizationId: ownership.organizationId,
            addonIds,
            active: false,
            source: 'subscription',
            subscriptionId: subscription.id,
            customerId: typeof subscription.customer === 'string'
              ? subscription.customer
              : subscription.customer?.id || null,
          });
        }

        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const subscriptionId = typeof invoice.subscription === 'string'
          ? invoice.subscription
          : invoice.subscription?.id;

        await markSubscriptionStatus(subscriptionId, 'past_due');
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    return json(res, { received: true }, 200);
  } catch (error) {
    console.error('[Webhook] Error:', error);
    return json(res, { error: 'Webhook processing failed', message: error.message }, 500);
  }
}
