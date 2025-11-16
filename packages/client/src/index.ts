/**
 * AgentCache Client SDK
 *
 * JavaScript/TypeScript client for AgentCache.ai
 * Edge caching for AI API calls - 90% cost reduction, 10x faster
 */

// Allow using process.env in Node without forcing a Node typings dependency
// This is safe in browsers because it's only referenced when present.
declare const process: any;

export interface AgentCacheConfig {
  apiKey: string;
  baseUrl?: string;
  namespace?: string;
  defaultTtl?: number; // seconds
}

export interface CacheMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CacheGetOptions {
  provider: string;
  model: string;
  messages: CacheMessage[];
  temperature?: number;
  namespace?: string;
}

export interface CacheSetOptions extends CacheGetOptions {
  response: string | any;
  ttl?: number;
}

export interface CacheGetResponse {
  hit: boolean;
  response?: string | any;
  cached_at?: string;
  latency_ms?: number;
}

export interface CacheSetResponse {
  success: boolean;
  cached_at: string;
}

export interface StatsResponse {
  period: string;
  namespace: string;
  metrics: {
    total_requests: number;
    cache_hits: number;
    hit_rate: number;
    tokens_saved: number;
    cost_saved: string;
    avg_latency_ms: number;
  };
  quota?: {
    monthly_limit: number;
    monthly_used: number;
    monthly_remaining: number;
    usage_percent: number;
  };
}

export interface MoonshotOptions {
  model?: string;
  messages: CacheMessage[];
  temperature?: number;
  cache_reasoning?: boolean;
  namespace?: string;
}

export interface MoonshotResponse {
  hit: boolean;
  response: string;
  reasoning?: {
    tokens: number;
    cost_saved: string;
    cached: boolean;
  };
  cached_at?: string;
  latency_ms: number;
  cached?: boolean;
}

export interface FetchOptions<T = any> {
  key: string | string[];
  tags?: string[];
  ttl?: number;
  fn: () => Promise<T> | T;
  namespace?: string;
}

export class AgentCache {
  private config: Required<AgentCacheConfig>;

  constructor(config: AgentCacheConfig | string) {
    if (typeof config === 'string') {
      this.config = {
        apiKey: config,
        baseUrl: 'https://agentcache.ai',
        namespace: 'default',
        defaultTtl: 604800, // 7 days
      };
    } else {
      this.config = {
        apiKey: config.apiKey,
        baseUrl: config.baseUrl || 'https://agentcache.ai',
        namespace: config.namespace || 'default',
        defaultTtl: config.defaultTtl || 604800,
      };
    }
  }

  /**
   * Create an AgentCache instance from environment variables.
   *
   * Looks for:
   * - AGENTCACHE_API_KEY (required)
   * - AGENTCACHE_BASE_URL (optional)
   * - AGENTCACHE_NAMESPACE (optional)
   *
   * This is primarily for Node/Edge runtimes.
   */
  static fromEnv(overrides: Partial<Omit<AgentCacheConfig, 'apiKey'>> = {}): AgentCache {
    const apiKey =
      (typeof process !== 'undefined' && process?.env?.AGENTCACHE_API_KEY) ||
      (typeof process !== 'undefined' && process?.env?.NEXT_PUBLIC_AGENTCACHE_API_KEY);

    if (!apiKey) {
      throw new Error('AGENTCACHE_API_KEY (or NEXT_PUBLIC_AGENTCACHE_API_KEY) is not set in the environment');
    }

    return new AgentCache({
      apiKey,
      baseUrl: overrides.baseUrl ||
        (typeof process !== 'undefined' && process?.env?.AGENTCACHE_BASE_URL) ||
        undefined,
      namespace: overrides.namespace ||
        (typeof process !== 'undefined' && process?.env?.AGENTCACHE_NAMESPACE) ||
        undefined,
      defaultTtl: overrides.defaultTtl,
    });
  }

  /**
   * High-level fetch wrapper - checks cache, calls function if miss, stores result
   * 
   * @example
   * ```ts
   * const result = await cache.fetch({
   *   key: ['openai', 'gpt-4', prompt],
   *   fn: () => openai.chat.completions.create({ model: 'gpt-4', messages: [...] })
   * });
   * ```
   */
  async fetch<T = any>(options: FetchOptions<T>): Promise<T> {
    const { key, fn, ttl, namespace } = options;
    const cacheKey = Array.isArray(key) ? key.join(':') : key;

    // Try to get from cache (simple string-based cache for now)
    // In production, this would use the cache/get endpoint with proper hashing
    const cached = await this._simpleGet(cacheKey, namespace);
    if (cached) {
      return cached as T;
    }

    // Cache miss - call function
    const result = await fn();

    // Store in cache
    await this._simpleSet(cacheKey, result, ttl, namespace);

    return result;
  }

  /**
   * Check if response is cached
   */
  async get(options: CacheGetOptions): Promise<CacheGetResponse> {
    const namespace = options.namespace || this.config.namespace;
    
    const response = await fetch(`${this.config.baseUrl}/api/cache/get`, {
      method: 'POST',
      headers: {
        'X-API-Key': this.config.apiKey,
        'X-Cache-Namespace': namespace,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: options.provider,
        model: options.model,
        messages: options.messages,
        temperature: options.temperature,
      }),
    });

    if (!response.ok) {
      const error: any = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json() as Promise<CacheGetResponse>;
  }

  /**
   * Store response in cache
   */
  async set(options: CacheSetOptions): Promise<CacheSetResponse> {
    const namespace = options.namespace || this.config.namespace;
    const ttl = options.ttl || this.config.defaultTtl;

    const response = await fetch(`${this.config.baseUrl}/api/cache/set`, {
      method: 'POST',
      headers: {
        'X-API-Key': this.config.apiKey,
        'X-Cache-Namespace': namespace,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: options.provider,
        model: options.model,
        messages: options.messages,
        temperature: options.temperature,
        response: options.response,
        ttl,
      }),
    });

    if (!response.ok) {
      const error: any = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json() as Promise<CacheSetResponse>;
  }

  /**
   * Moonshot AI (Kimi K2) with reasoning token caching
   * 
   * @example
   * ```ts
   * const result = await cache.moonshot({
   *   model: 'moonshot-v1-128k',
   *   messages: [{ role: 'user', content: 'Analyze this code' }],
   *   cache_reasoning: true
   * });
   * // 98% cost savings on reasoning-heavy queries!
   * ```
   */
  async moonshot(options: MoonshotOptions): Promise<MoonshotResponse> {
    const namespace = options.namespace || this.config.namespace;

    const response = await fetch(`${this.config.baseUrl}/api/moonshot`, {
      method: 'POST',
      headers: {
        'X-API-Key': this.config.apiKey,
        'X-Cache-Namespace': namespace,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model || 'moonshot-v1-128k',
        messages: options.messages,
        temperature: options.temperature,
        cache_reasoning: options.cache_reasoning !== false, // default true
      }),
    });

    if (!response.ok) {
      const error: any = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json() as Promise<MoonshotResponse>;
  }

  /**
   * Get usage statistics
   */
  async stats(period: '1h' | '24h' | '7d' | '30d' = '24h'): Promise<StatsResponse> {
    const response = await fetch(`${this.config.baseUrl}/api/stats?period=${period}`, {
      method: 'GET',
      headers: {
        'X-API-Key': this.config.apiKey,
      },
    });

    if (!response.ok) {
      const error: any = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json() as Promise<StatsResponse>;
  }

  // Simple cache methods (future: proper implementation)
  private async _simpleGet(key: string, namespace?: string): Promise<any | null> {
    // This is a placeholder - real implementation would use cache/get
    return null;
  }

  private async _simpleSet(key: string, value: any, ttl?: number, namespace?: string): Promise<void> {
    // This is a placeholder - real implementation would use cache/set
  }
}

/**
 * Utility: normalize messages to improve cache hit rate.
 *
 * Strips common volatile markers like timestamps or session IDs
 * that would otherwise cause identical prompts to miss the cache.
 */
export function normalizeMessages(messages: CacheMessage[]): CacheMessage[] {
  return messages.map((msg) => ({
    role: msg.role,
    content: msg.content
      .replace(/\[Timestamp: .*?\]/g, '')
      .replace(/Session ID: \w+/g, '')
      .trim(),
  }));
}

export interface CachedLLMCallOptions {
  provider: string;
  model: string;
  messages: CacheMessage[];
  temperature?: number;
  namespace?: string;
  ttl?: number;
  /** Optional custom normalizer, defaults to normalizeMessages */
  normalizeMessages?: (messages: CacheMessage[]) => CacheMessage[];
}

export interface CachedLLMCallResult<TResponse> {
  hit: boolean;
  response: TResponse;
}

/**
 * High-level helper: wrap a single LLM call with AgentCache.
 *
 * This is the "five-line" integration most users want:
 *
 * ```ts
 * const { hit, response } = await cachedLLMCall(cache, {
 *   provider: 'openai',
 *   model: 'gpt-4',
 *   messages,
 * }, () => openai.chat.completions.create({ ... }));
 * ```
 *
 * If the response is not a string, it is JSON-stringified for storage and
 * automatically parsed back out on cache hits.
 */
export async function cachedLLMCall<TResponse = any>(
  cache: AgentCache,
  options: CachedLLMCallOptions,
  callLLM: () => Promise<TResponse>,
): Promise<CachedLLMCallResult<TResponse>> {
  const normalizer = options.normalizeMessages ?? normalizeMessages;
  const namespace = options.namespace;

  const normalizedMessages = normalizer(options.messages);

  // 1) Try cache first
  try {
    const cached = await cache.get({
      provider: options.provider,
      model: options.model,
      messages: normalizedMessages,
      temperature: options.temperature,
      namespace,
    });

    if (cached.hit && typeof cached.response !== 'undefined') {
      let value: any = cached.response;
      if (typeof value === 'string') {
        try {
          value = JSON.parse(value);
        } catch {
          // keep as raw string
        }
      }

      return { hit: true, response: value as TResponse };
    }
  } catch {
    // Cache failures should not break LLM calls; fall through
  }

  // 2) Cache miss or cache error → call LLM
  const result = await callLLM();

  // 3) Store in cache (fire-and-forget; don't block on cache errors)
  (async () => {
    try {
      const ttl = options.ttl;
      let toStore: any = result;
      if (typeof toStore !== 'string') {
        toStore = JSON.stringify(toStore);
      }

      await cache.set({
        provider: options.provider,
        model: options.model,
        messages: normalizedMessages,
        temperature: options.temperature,
        namespace,
        response: toStore,
        ttl,
      });
    } catch {
      // ignore
    }
  })();

  return { hit: false, response: result };
}

// Default export
export default AgentCache;

// Named exports for convenience
export { AgentCache as AgentCacheClient };
