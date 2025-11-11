/**
 * AgentCache Client SDK
 * 
 * JavaScript/TypeScript client for AgentCache.ai
 * Edge caching for AI API calls - 90% cost reduction, 10x faster
 */

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

// Default export
export default AgentCache;

// Named exports for convenience
export { AgentCache as AgentCacheClient };
