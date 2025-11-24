/**
 * AgentCache Standard - TypeScript Types
 */

export interface AgentCacheConfig {
  /** Your AgentCache API key (starts with 'ac_live_' or 'ac_demo_') */
  apiKey: string;
  /** API endpoint (default: https://agentcache.ai) */
  endpoint?: string;
  /** Namespace for multi-tenant usage (optional) */
  namespace?: string;
  /** Request timeout in milliseconds (default: 10000) */
  timeout?: number;
}

export interface CacheParams {
  /** AI provider (e.g., 'openai', 'anthropic', 'gemini') */
  provider: string;
  /** Model name (e.g., 'gpt-4', 'claude-3-sonnet') */
  model: string;
  /** Chat messages array */
  messages: Message[];
  /** Temperature parameter (default: 1.0) */
  temperature?: number;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GetResult<T = any> {
  /** Whether the response was found in cache */
  hit: boolean;
  /** Cached response value (only if hit=true) */
  value?: T;
  /** Age of cached entry in seconds (only if hit=true) */
  age?: number;
  /** Namespace used (only if hit=true) */
  namespace?: string;
  /** Response latency in milliseconds */
  latency?: number;
}

export interface SetOptions {
  /** Time-to-live in seconds (default: 604800 = 7 days) */
  ttl?: number;
}

export interface CheckResult {
  /** Whether the response is cached */
  cached: boolean;
  /** Remaining TTL in seconds (only if cached=true) */
  ttl?: number;
}

export interface CacheStats {
  /** Time period for stats */
  period: string;
  /** Namespace filter (if provided) */
  namespace?: string;
  /** Cache metrics */
  metrics: {
    total_requests: number;
    cache_hits: number;
    hit_rate: number;
    tokens_saved: number;
    cost_saved: string;
    avg_latency_ms: number;
  };
  /** Usage quota information */
  quota?: {
    monthly_limit: number;
    monthly_used: number;
    monthly_remaining: number;
    usage_percent: number;
  };
  /** Performance metrics */
  performance?: {
    requests_per_day: number;
    efficiency_score: number;
    cost_reduction_percent: number;
  };
}

export class AgentCacheError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'AgentCacheError';
  }
}
