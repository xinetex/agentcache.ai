import * as crypto from 'crypto';
import { neon } from '@neondatabase/serverless';
import * as bcrypt from 'bcryptjs';
import { redis } from '../lib/redis.js';

// Initialize Neon (Fail gracefully)
let sql: any;
try {
  if (process.env.DATABASE_URL) {
    sql = neon(process.env.DATABASE_URL);
  } else {
    console.warn('[Provisioning] DATABASE_URL missing - Neon client disabled');
  }
} catch (e) {
  console.warn('[Provisioning] Neon init failed:', e);
}

// Note: Migrating from in-memory to Postgres persistence

interface ApiKey {
  key: string;
  user_id: string;
  integration: string;
  project_id: string;
  rate_limit: number;
  usage_count: number;
  created_at: Date;
}

interface Namespace {
  name: string;
  user_id: string;
  sector?: string;
  use_case?: string;
  created_at: Date;
}

interface Installation {
  id: string;
  user_id: string;
  platform: 'vercel' | 'netlify' | 'railway' | 'manual' | 'web';
  project_id: string;
  config_id: string;
  api_key_id: string;
  namespace: string;
  installed_at: Date;
  last_used_at?: Date;
}

// Temporary in-memory storage
const apiKeys: Map<string, ApiKey> = new Map();
const namespaces: Map<string, Namespace> = new Map();
const installations: Map<string, Installation> = new Map();

/**
 * Generate a new API key for an integration
 */
export async function generateApiKey(params: {
  user_id: string;
  integration: string;
  project_id: string;
}): Promise<string> {
  // Generate secure random key
  const randomBytes = crypto.randomBytes(32).toString('hex');
  const key = `ac_${params.integration}_${randomBytes}`;

  // Hash the key for storage
  const keyHash = await bcrypt.hash(key, 10);
  const keyPrefix = key.substring(0, 12);

  // Store in Postgres
  await sql`
    INSERT INTO api_keys (user_id, key_hash, key_prefix, scopes, allowed_namespaces)
    VALUES (
      ${params.user_id},
      ${keyHash},
      ${keyPrefix},
      '["cache:read", "cache:write"]'::jsonb,
      '["*"]'::jsonb
    )
  `;

  // Also keep in memory for backwards compat during transition
  const apiKey: ApiKey = {
    key,
    user_id: params.user_id,
    integration: params.integration,
    project_id: params.project_id,
    rate_limit: 100000,
    usage_count: 0,
    created_at: new Date()
  };
  apiKeys.set(key, apiKey);

  console.log(`[Provisioning] Generated API key for user ${params.user_id}, project ${params.project_id}`);

  return key;
}

/**
 * Create a new namespace for a user
 */
export async function createNamespace(params: {
  name: string;
  user_id: string;
  sector?: string;
  use_case?: string;
}): Promise<string> {
  const namespace: Namespace = {
    name: params.name,
    user_id: params.user_id,
    sector: params.sector,
    use_case: params.use_case,
    created_at: new Date()
  };

  namespaces.set(params.name, namespace);

  console.log(`[Provisioning] Created namespace ${params.name} for user ${params.user_id}`);

  return params.name;
}

/**
 * Record an installation
 */
export async function recordInstallation(params: {
  user_id: string;
  platform: 'vercel' | 'netlify' | 'railway' | 'manual' | 'web';
  project_id: string;
  config_id: string;
  api_key: string;
  namespace: string;
}): Promise<Installation> {
  const installation: Installation = {
    id: crypto.randomUUID(),
    user_id: params.user_id,
    platform: params.platform,
    project_id: params.project_id,
    config_id: params.config_id,
    api_key_id: params.api_key,
    namespace: params.namespace,
    installed_at: new Date()
  };

  installations.set(installation.id, installation);

  console.log(`[Provisioning] Recorded ${params.platform} installation for project ${params.project_id}`);

  return installation;
}

/**
 * Validate an API key against Postgres with Redis caching
 */
export async function validateApiKey(key: string): Promise<ApiKey | null> {
  // Check in-memory first for demo keys
  const memKey = apiKeys.get(key);
  if (memKey) return memKey;

  // Check Redis cache (5 min TTL)
  const keyHash = crypto.createHash('sha256').update(key).digest('hex');
  const cacheKey = `validated:${keyHash}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    console.error('[Provisioning] Redis cache error:', error);
  }

  // Query Postgres for active keys
  try {
    const keys = await sql`
      SELECT * FROM api_keys 
      WHERE is_active = TRUE
    `;

    for (const record of keys) {
      const match = await bcrypt.compare(key, record.key_hash);
      if (match) {
        // Return in ApiKey format
        const result = {
          key,
          user_id: record.user_id,
          integration: 'postgres',
          project_id: 'n/a',
          rate_limit: 10000,
          usage_count: Number(record.request_count),
          created_at: new Date(record.created_at)
        };

        // Cache in Redis for 5 minutes
        try {
          await redis.setex(cacheKey, 300, JSON.stringify(result));
        } catch (error) {
          console.error('[Provisioning] Redis cache write error:', error);
        }

        return result;
      }
    }
  } catch (error) {
    console.error('[Provisioning] Postgres validation error:', error);
  }

  return null;
}

/**
 * Get namespace details
 */
export async function getNamespace(name: string): Promise<Namespace | null> {
  return namespaces.get(name) || null;
}

/**
 * Get installations for a user
 */
export async function getUserInstallations(user_id: string): Promise<Installation[]> {
  return Array.from(installations.values())
    .filter(inst => inst.user_id === user_id);
}

/**
 * Update installation last used timestamp
 */
export async function touchInstallation(installationId: string): Promise<void> {
  const installation = installations.get(installationId);
  if (installation) {
    installation.last_used_at = new Date();
    console.log(`[Provisioning] Updated last_used_at for installation ${installationId}`);
  }
}

// Export storage for development/debugging
export const __dev = {
  apiKeys,
  namespaces,
  installations
};
