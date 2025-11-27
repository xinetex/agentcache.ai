/**
 * @agentcache/sdk - Official Node.js/TypeScript SDK for AgentCache.ai
 *
 * Cognitive Caching for AI Agents
 *
 * @example
 * ```typescript
 * import { AgentCache, Sector } from '@agentcache/sdk';
 *
 * const cache = new AgentCache({
 *   apiKey: 'sk_live_...',
 *   sector: Sector.HEALTHCARE
 * });
 *
 * const response = await cache.query('What is HIPAA?');
 * console.log(response.result);
 * ```
 *
 * @packageDocumentation
 */

export { AgentCache } from './client';
export {
  Sector,
  ComplianceFramework,
  CacheTier,
  NodeType,
  QueryRequest,
  CacheResponse,
  CacheMetrics,
  NodeConfig,
  EdgeConfig,
  PipelineConfig,
  WebhookConfig,
  WebhookEvent,
  AgentCacheConfig,
  ErrorResponse,
  QueryRequestSchema,
} from './types';
export {
  AgentCacheError,
  AuthenticationError,
  RateLimitError,
  ValidationError,
  NotFoundError,
  ServerError,
  TimeoutError,
  NetworkError,
} from './exceptions';
