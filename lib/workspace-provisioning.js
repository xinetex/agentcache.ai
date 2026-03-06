import crypto from 'crypto';

const PLAN_LIMITS = {
  starter: { maxNamespaces: 5, maxApiKeys: 3, maxUsers: 5 },
  professional: { maxNamespaces: 10, maxApiKeys: 10, maxUsers: 25 },
  enterprise: { maxNamespaces: 100, maxApiKeys: 100, maxUsers: 500 },
};

export function getPlanLimits(planTier = 'starter') {
  return PLAN_LIMITS[planTier] || PLAN_LIMITS.starter;
}

export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 48) || 'workspace';
}

export async function generateUniqueSlug(client, baseSlug) {
  const normalized = slugify(baseSlug);

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const suffix = attempt === 0 ? '' : `-${attempt + 1}`;
    const candidate = `${normalized}${suffix}`;
    const result = await client.query(
      'SELECT 1 FROM organizations WHERE slug = $1 LIMIT 1',
      [candidate]
    );

    if (result.rows.length === 0) {
      return candidate;
    }
  }

  throw new Error('Failed to generate a unique workspace slug');
}

export function generateWorkspaceName(fullName, email) {
  const fallback = String(email || 'workspace')
    .split('@')[0]
    .replace(/[._-]+/g, ' ')
    .trim();
  const label = String(fullName || fallback || 'Workspace').trim();
  return `${label}'s Workspace`;
}

export function generateApiKey(prefix = 'ac_live') {
  return `${prefix}_${crypto.randomBytes(24).toString('base64url')}`;
}

export function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

export function getKeyPrefix(apiKey, length = 16) {
  return apiKey.slice(0, length);
}
