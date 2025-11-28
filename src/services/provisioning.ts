import crypto from 'crypto';

// Note: Database imports will be added when schema is ready
// For now, we'll use in-memory storage for development

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
  platform: 'vercel' | 'netlify' | 'railway' | 'manual';
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
  
  // Store API key
  const apiKey: ApiKey = {
    key,
    user_id: params.user_id,
    integration: params.integration,
    project_id: params.project_id,
    rate_limit: 100000, // Free tier: 100k requests/month
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
  platform: 'vercel' | 'netlify' | 'railway' | 'manual';
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
 * Validate an API key
 */
export async function validateApiKey(key: string): Promise<ApiKey | null> {
  return apiKeys.get(key) || null;
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
