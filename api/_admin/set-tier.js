/**
 * Admin endpoint to override an organization's billing tier.
 *
 * This route is intentionally defensive because older deployments used
 * organizations.plan + api_keys.hash, while the current portal code uses
 * organizations.plan_tier + api_keys.key_hash.
 */
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

import { query, transaction } from '../../lib/db.js';
import {
  getBillingPlanByPublicId,
  getPlanLimitsSnapshot,
  getPublicPlanIdFromInternalTier,
  getQuotaForInternalPlan,
  normalizeInternalPlanTier,
} from '../../lib/billing-plans.js';

export const config = {
  runtime: 'nodejs',
};

function setCors(res) {
  if (!res?.setHeader) {
    return;
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token');
}

function sendJson(res, data, status = 200) {
  if (res?.status && res?.json) {
    return res.status(status).json(data);
  }

  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function getHeader(req, name) {
  if (typeof req.headers?.get === 'function') {
    return req.headers.get(name) || req.headers.get(name.toLowerCase());
  }

  const value = req.headers?.[name.toLowerCase()] ?? req.headers?.[name];
  return Array.isArray(value) ? value[0] : value || null;
}

function extractAdminToken(req, body) {
  const explicit = getHeader(req, 'x-admin-token');
  if (explicit) {
    return explicit;
  }

  const authorization = getHeader(req, 'authorization');
  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length);
  }

  return body?.adminToken || null;
}

async function parseBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  if (typeof req.body === 'string') {
    return JSON.parse(req.body || '{}');
  }

  if (typeof req.json === 'function') {
    return req.json();
  }

  return {};
}

function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

function getKeyPrefix(apiKey) {
  return String(apiKey || '').slice(0, 16);
}

function looksLikeBcryptHash(value) {
  return typeof value === 'string' && value.startsWith('$2');
}

function looksLikeSha256(value) {
  return /^[a-f0-9]{64}$/i.test(String(value || ''));
}

function normalizeSqlIdentifier(identifier) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(identifier)) {
    throw new Error(`Invalid SQL identifier: ${identifier}`);
  }

  return `"${identifier}"`;
}

async function getTableColumns(client, tableName) {
  const result = await client.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
    `,
    [tableName]
  );

  return new Set(result.rows.map((row) => row.column_name));
}

async function getSchemaColumns(client) {
  return {
    organizations: await getTableColumns(client, 'organizations'),
    apiKeys: await getTableColumns(client, 'api_keys'),
  };
}

function getOrganizationTierExpression(columns, alias = '') {
  const qualifier = alias ? `${alias}.` : '';

  if (columns.organizations.has('plan_tier')) {
    return `${qualifier}${normalizeSqlIdentifier('plan_tier')}`;
  }

  if (columns.organizations.has('plan')) {
    return `${qualifier}${normalizeSqlIdentifier('plan')}`;
  }

  return 'NULL::text';
}

function getApiKeyColumnMap(columns) {
  const organization = columns.apiKeys.has('organization_id') ? 'organization_id' : 'org_id';
  const hash = columns.apiKeys.has('key_hash') ? 'key_hash' : 'hash';
  const prefix = columns.apiKeys.has('key_prefix') ? 'key_prefix' : 'prefix';

  if (!columns.apiKeys.has(organization) || !columns.apiKeys.has(hash) || !columns.apiKeys.has(prefix)) {
    throw Object.assign(new Error('api_keys table does not contain recognizable key columns'), { status: 500 });
  }

  return {
    organization,
    hash,
    prefix,
    hasIsActive: columns.apiKeys.has('is_active'),
  };
}

function getActiveKeyPredicate(columnMap) {
  return columnMap.hasIsActive ? 'AND ak.is_active = true' : '';
}

function resolvePlan(rawTier) {
  const requestedTier = String(rawTier || '').toLowerCase();
  const publicPlan = getBillingPlanByPublicId(requestedTier);

  if (publicPlan) {
    return {
      publicPlan: publicPlan.publicId,
      internalPlan: publicPlan.internalId,
      quota: publicPlan.quota,
      limits: getPlanLimitsSnapshot(publicPlan.internalId),
    };
  }

  const internalPlan = normalizeInternalPlanTier(requestedTier);
  const mappedPublicPlan = getPublicPlanIdFromInternalTier(internalPlan);
  const mappedPlan = getBillingPlanByPublicId(mappedPublicPlan);

  if (!mappedPlan || !['starter', 'professional', 'enterprise'].includes(internalPlan)) {
    return null;
  }

  return {
    publicPlan: mappedPlan.publicId,
    internalPlan,
    quota: getQuotaForInternalPlan(internalPlan),
    limits: getPlanLimitsSnapshot(internalPlan),
  };
}

async function findOrganizationById(client, columns, organizationId) {
  const tierExpression = getOrganizationTierExpression(columns);
  const nameExpression = columns.organizations.has('name') ? 'name' : 'NULL::text';

  const result = await client.query(
    `
      SELECT id, ${nameExpression} AS name, ${tierExpression} AS plan_tier
      FROM organizations
      WHERE id = $1
      LIMIT 1
    `,
    [organizationId]
  );

  return result.rows[0] || null;
}

async function findOrganizationByExactKeyHash(client, columns, keyHash) {
  const columnMap = getApiKeyColumnMap(columns);
  const organizationColumn = normalizeSqlIdentifier(columnMap.organization);
  const hashColumn = normalizeSqlIdentifier(columnMap.hash);
  const activePredicate = getActiveKeyPredicate(columnMap);
  const tierExpression = getOrganizationTierExpression(columns, 'o');
  const nameExpression = columns.organizations.has('name') ? `o.${normalizeSqlIdentifier('name')}` : 'NULL::text';

  const result = await client.query(
    `
      SELECT o.id, ${nameExpression} AS name, ${tierExpression} AS plan_tier, ak.${hashColumn} AS key_hash
      FROM api_keys ak
      JOIN organizations o ON o.id = ak.${organizationColumn}
      WHERE ak.${hashColumn} = $1
        ${activePredicate}
      LIMIT 1
    `,
    [keyHash]
  );

  return result.rows[0] || null;
}

async function findOrganizationsByKeyPrefix(client, columns, keyPrefix) {
  const columnMap = getApiKeyColumnMap(columns);
  const organizationColumn = normalizeSqlIdentifier(columnMap.organization);
  const hashColumn = normalizeSqlIdentifier(columnMap.hash);
  const prefixColumn = normalizeSqlIdentifier(columnMap.prefix);
  const activePredicate = getActiveKeyPredicate(columnMap);
  const tierExpression = getOrganizationTierExpression(columns, 'o');
  const nameExpression = columns.organizations.has('name') ? `o.${normalizeSqlIdentifier('name')}` : 'NULL::text';

  const result = await client.query(
    `
      SELECT o.id, ${nameExpression} AS name, ${tierExpression} AS plan_tier, ak.${hashColumn} AS key_hash
      FROM api_keys ak
      JOIN organizations o ON o.id = ak.${organizationColumn}
      WHERE ak.${prefixColumn} = $1
        ${activePredicate}
    `,
    [keyPrefix]
  );

  return result.rows;
}

async function resolveOrganization(client, columns, body) {
  const organizationId = body.organizationId || body.orgId;

  if (organizationId) {
    const organization = await findOrganizationById(client, columns, organizationId);
    if (!organization) {
      throw Object.assign(new Error('Organization not found'), { status: 404 });
    }

    return { organization, rawApiKeyHash: null };
  }

  if (body.keyHash) {
    const keyHash = String(body.keyHash);
    const organization = await findOrganizationByExactKeyHash(client, columns, keyHash);

    if (!organization) {
      throw Object.assign(new Error('API key hash did not match an active organization'), { status: 404 });
    }

    return {
      organization,
      rawApiKeyHash: looksLikeSha256(keyHash) ? keyHash : null,
    };
  }

  if (body.apiKey) {
    const apiKey = String(body.apiKey);
    const rawApiKeyHash = hashApiKey(apiKey);
    const exactMatch = await findOrganizationByExactKeyHash(client, columns, rawApiKeyHash);

    if (exactMatch) {
      return { organization: exactMatch, rawApiKeyHash };
    }

    const candidates = await findOrganizationsByKeyPrefix(
      client,
      columns,
      body.keyPrefix ? String(body.keyPrefix) : getKeyPrefix(apiKey)
    );

    for (const candidate of candidates) {
      const storedHash = String(candidate.key_hash || '');
      const isMatch =
        storedHash === rawApiKeyHash ||
        (looksLikeBcryptHash(storedHash) && await bcrypt.compare(apiKey, storedHash));

      if (isMatch) {
        return { organization: candidate, rawApiKeyHash };
      }
    }

    throw Object.assign(new Error('API key did not match an active organization'), { status: 404 });
  }

  if (body.keyPrefix) {
    const candidates = await findOrganizationsByKeyPrefix(client, columns, String(body.keyPrefix));

    if (candidates.length === 0) {
      throw Object.assign(new Error('API key prefix did not match an active organization'), { status: 404 });
    }

    if (candidates.length > 1) {
      throw Object.assign(new Error('API key prefix is ambiguous; provide apiKey, keyHash, or organizationId'), {
        status: 409,
      });
    }

    const keyHash = String(candidates[0].key_hash || '');
    return {
      organization: candidates[0],
      rawApiKeyHash: looksLikeSha256(keyHash) ? keyHash : null,
    };
  }

  throw Object.assign(new Error('organizationId, apiKey, keyHash, or keyPrefix is required'), { status: 400 });
}

async function updateOrganizationTier(client, columns, organizationId, plan) {
  const sets = [];
  const params = [organizationId];

  function addSet(columnName, value) {
    if (!columns.organizations.has(columnName)) {
      return;
    }

    params.push(value);
    sets.push(`${normalizeSqlIdentifier(columnName)} = $${params.length}`);
  }

  addSet('plan_tier', plan.internalPlan);
  addSet('plan', plan.publicPlan);
  addSet('max_namespaces', plan.limits.maxNamespaces);
  addSet('max_api_keys', plan.limits.maxApiKeys);
  addSet('max_users', plan.limits.maxUsers);

  if (columns.organizations.has('status')) {
    sets.push('status = \'active\'');
  }

  if (columns.organizations.has('updated_at')) {
    sets.push('updated_at = NOW()');
  }

  if (sets.length === 0) {
    throw Object.assign(new Error('organizations table does not contain a writable plan column'), { status: 500 });
  }

  await client.query(
    `
      UPDATE organizations
      SET ${sets.join(', ')}
      WHERE id = $1
    `,
    params
  );
}

async function upstashCommand(command, ...segments) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return false;
  }

  const path = [command, ...segments].map((segment) => encodeURIComponent(String(segment))).join('/');
  const response = await fetch(`${url.replace(/\/$/, '')}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Upstash ${command} failed with status ${response.status}`);
  }

  return true;
}

async function syncRedisForOrganization(columns, organizationId, plan, rawApiKeyHash) {
  const configured = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  if (!configured) {
    return { configured: false, hashes: 0, writes: 0 };
  }

  const columnMap = getApiKeyColumnMap(columns);
  const organizationColumn = normalizeSqlIdentifier(columnMap.organization);
  const hashColumn = normalizeSqlIdentifier(columnMap.hash);
  const activePredicate = columnMap.hasIsActive ? 'AND is_active = true' : '';

  const apiKeysResult = await query(
    `
      SELECT ${hashColumn} AS key_hash
      FROM api_keys
      WHERE ${organizationColumn} = $1
        ${activePredicate}
    `,
    [organizationId]
  );

  const hashes = new Set();
  if (rawApiKeyHash) {
    hashes.add(rawApiKeyHash);
  }

  for (const row of apiKeysResult.rows) {
    const keyHash = String(row.key_hash || '');
    if (looksLikeSha256(keyHash)) {
      hashes.add(keyHash);
    }
  }

  const operations = [];
  for (const keyHash of hashes) {
    operations.push(upstashCommand('set', `tier:${keyHash}`, plan.publicPlan));
    operations.push(upstashCommand('set', `usage:${keyHash}:quota`, plan.quota));
    operations.push(upstashCommand('set', `usage:${keyHash}/monthlyQuota`, plan.quota));
    operations.push(upstashCommand('hset', `usage:${keyHash}`, 'plan', plan.publicPlan, 'monthlyQuota', plan.quota));
  }

  const results = await Promise.allSettled(operations);
  const failed = results.filter((result) => result.status === 'rejected');

  return {
    configured: true,
    hashes: hashes.size,
    writes: results.length - failed.length,
    failed: failed.length,
    error: failed[0]?.reason?.message,
  };
}

async function writeAuditLog(entry) {
  try {
    const pushed = await upstashCommand('lpush', 'audit:tier_changes', JSON.stringify(entry));
    if (pushed) {
      await upstashCommand('ltrim', 'audit:tier_changes', '0', '999');
    }

    return Boolean(pushed);
  } catch (error) {
    console.error('[Admin] Failed to write tier audit log:', error);
    return false;
  }
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res?.status ? res.status(200).end() : new Response(null, { status: 200 });
  }

  if (req.method !== 'POST') {
    return sendJson(res, { error: 'Method not allowed' }, 405);
  }

  try {
    const body = await parseBody(req);
    const adminToken = extractAdminToken(req, body);

    if (!adminToken || !process.env.ADMIN_TOKEN || adminToken !== process.env.ADMIN_TOKEN) {
      return sendJson(res, { error: 'Unauthorized - Admin access required' }, 401);
    }

    const plan = resolvePlan(body.tier);
    if (!plan) {
      return sendJson(res, {
        error: 'Invalid tier',
        validTiers: ['free', 'pro', 'enterprise', 'starter', 'professional'],
      }, 400);
    }

    let resolved;
    let columns;

    await transaction(async (client) => {
      columns = await getSchemaColumns(client);
      resolved = await resolveOrganization(client, columns, body);
      await updateOrganizationTier(client, columns, resolved.organization.id, plan);
    });

    const redis = await syncRedisForOrganization(columns, resolved.organization.id, plan, resolved.rawApiKeyHash);
    const auditLogged = await writeAuditLog({
      action: 'tier_change',
      organizationId: resolved.organization.id,
      organizationName: resolved.organization.name || null,
      oldTier: resolved.organization.plan_tier || null,
      newTier: plan.internalPlan,
      publicPlan: plan.publicPlan,
      reason: String(body.reason || 'Manual override by admin'),
      actor: 'admin_token',
      timestamp: new Date().toISOString(),
    });

    return sendJson(res, {
      success: true,
      organizationId: resolved.organization.id,
      previousTier: resolved.organization.plan_tier || null,
      tier: plan.internalPlan,
      publicPlan: plan.publicPlan,
      quota: plan.quota,
      limits: plan.limits,
      redis,
      auditLogged,
      message: redis.configured
        ? 'Tier updated in Postgres and Redis cache sync attempted.'
        : 'Tier updated in Postgres. Redis sync skipped because Upstash is not configured.',
    });
  } catch (error) {
    console.error('[Admin] Set tier error:', error);
    return sendJson(res, {
      error: 'Failed to set tier',
      message: error.message,
    }, error.status || 500);
  }
}
