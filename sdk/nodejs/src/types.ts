/**
 * Type definitions for AgentCache SDK
 */

import { z } from 'zod';

/**
 * Available market sectors for pipeline templates
 */
export enum Sector {
  HEALTHCARE = 'healthcare',
  FINANCE = 'finance',
  LEGAL = 'legal',
  EDUCATION = 'education',
  ECOMMERCE = 'ecommerce',
  ENTERPRISE = 'enterprise',
  DEVELOPER = 'developer',
  DATASCIENCE = 'datascience',
  GOVERNMENT = 'government',
  GENERAL = 'general',
}

/**
 * Supported compliance frameworks
 */
export enum ComplianceFramework {
  HIPAA = 'HIPAA',
  HITECH = 'HITECH',
  PCI_DSS = 'PCI-DSS',
  SOC2 = 'SOC2',
  GDPR = 'GDPR',
  CCPA = 'CCPA',
  FERPA = 'FERPA',
  FINRA = 'FINRA',
  GLBA = 'GLBA',
  FEDRAMP = 'FedRAMP',
  ITAR = 'ITAR',
}

/**
 * Cache complexity tiers
 */
export enum CacheTier {
  BASIC = 'basic',
  ADVANCED = 'advanced',
  ENTERPRISE = 'enterprise',
}

/**
 * Pipeline node types
 */
export enum NodeType {
  LLM_CACHE = 'llm_cache',
  SEMANTIC_CACHE = 'semantic_cache',
  EXACT_MATCH = 'exact_match',
  PHI_FILTER = 'phi_filter',
  PCI_FILTER = 'pci_filter',
  FRAUD_DETECTOR = 'fraud_detector',
  PRIVILEGE_GUARD = 'privilege_guard',
  FERPA_FILTER = 'ferpa_filter',
  SSO_CONNECTOR = 'sso_connector',
  SECRET_SCANNER = 'secret_scanner',
  EMBEDDING_CACHE = 'embedding_cache',
  SECURITY_GATE = 'security_gate',
}

/**
 * Request model for cache queries
 */
export const QueryRequestSchema = z.object({
  prompt: z.string().describe('The query prompt to cache/retrieve'),
  context: z.record(z.any()).optional().describe('Additional context for the query'),
  metadata: z.record(z.any()).optional().describe('Custom metadata to attach'),
  ttl: z.number().optional().describe('Time-to-live in seconds (overrides default)'),
  invalidate_on: z.array(z.string()).optional().describe('Events that should invalidate this cache entry'),
  namespace: z.string().optional().describe('Namespace for multi-tenant isolation'),
  compliance: z.array(z.nativeEnum(ComplianceFramework)).optional().describe('Required compliance frameworks'),
  sector: z.nativeEnum(Sector).optional().describe('Market sector'),
});

export type QueryRequest = z.infer<typeof QueryRequestSchema>;

/**
 * Metrics for a cache response
 */
export interface CacheMetrics {
  hit_rate?: number;
  latency_ms?: number;
  savings_usd?: number;
  tokens_saved?: number;
}

/**
 * Response model for cache queries
 */
export interface CacheResponse {
  cache_hit: boolean;
  result: string;
  metadata: Record<string, any>;
  metrics?: CacheMetrics;
  cache_key?: string;
  expires_at?: Date;
  compliance_validated?: ComplianceFramework[];
}

/**
 * Configuration for a pipeline node
 */
export interface NodeConfig {
  type: NodeType;
  position: { x: number; y: number };
  config: Record<string, any>;
}

/**
 * Configuration for a pipeline edge
 */
export interface EdgeConfig {
  source: string;
  target: string;
  label?: string;
}

/**
 * Configuration for a complete pipeline
 */
export interface PipelineConfig {
  name: string;
  sector: Sector;
  description?: string;
  nodes: NodeConfig[];
  edges: EdgeConfig[];
  compliance?: ComplianceFramework[];
  tier: CacheTier;
}

/**
 * Configuration for webhook subscriptions
 */
export interface WebhookConfig {
  url: string;
  events: string[];
  secret?: string;
  active?: boolean;
}

/**
 * Webhook event payload
 */
export interface WebhookEvent {
  id: string;
  type: string;
  timestamp: Date;
  data: Record<string, any>;
  pipeline_id?: string;
}

/**
 * AgentCache client configuration
 */
export interface AgentCacheConfig {
  apiKey?: string;
  baseUrl?: string;
  sector?: Sector;
  compliance?: ComplianceFramework[];
  timeout?: number;
  maxRetries?: number;
  namespace?: string;
}

/**
 * Error response from API
 */
export interface ErrorResponse {
  error: string;
  status_code: number;
  details?: Record<string, any>;
}

export interface VerificationResult {
  verdict: 'TRUE' | 'FALSE' | 'UNCERTAIN';
  confidence: number;
  reasoning: string;
  sources?: string[];
}

export interface VerificationResponse {
  meta: {
    credits_deducted: number;
    model: string;
  };
  data: VerificationResult;
}
