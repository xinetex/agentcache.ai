/**
 * AgentCache Lite
 * Zero-dependency, in-memory LRU cache for AI responses
 * Perfect for getting started - upgrade to AgentCache Standard when you need persistence
 */

export interface CacheEntry<T = any> {
  value: T;
  expires: number;
  hits: number;
  createdAt: number;
}

export interface CacheOptions {
  /** Maximum number of entries (default: 100) */
  maxSize?: number;
  /** Default TTL in seconds (default: 3600 = 1 hour) */
  defaultTTL?: number;
  /** Enable telemetry for upgrade recommendations (default: false) */
  telemetry?: boolean;
  /** Namespace for multi-tenant use (optional) */
  namespace?: string;
}

export interface CacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
  memoryEstimate: string;
}

export interface GetResult<T = any> {
  hit: boolean;
  value?: T;
  age?: number;
  namespace?: string;
}

export interface SetOptions {
  /** TTL in seconds (overrides default) */
  ttl?: number;
}

export class AgentCacheLite {
  private cache: Map<string, CacheEntry>;
  private accessOrder: string[]; // For LRU tracking
  private maxSize: number;
  private defaultTTL: number;
  private telemetry: boolean;
  private namespace: string;
  
  // Statistics
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalRequests: 0,
  };

  constructor(options: CacheOptions = {}) {
    this.cache = new Map();
    this.accessOrder = [];
    this.maxSize = options.maxSize || 100;
    this.defaultTTL = (options.defaultTTL || 3600) * 1000; // Convert to ms
    this.telemetry = options.telemetry || false;
    this.namespace = options.namespace || 'default';
  }

  /**
   * Generate cache key from request parameters
   * Matches AgentCache.ai key generation for easy upgrade path
   */
  private generateKey(params: {
    provider: string;
    model: string;
    messages: any[];
    temperature?: number;
  }): string {
    const normalized = {
      provider: params.provider.toLowerCase(),
      model: params.model.toLowerCase(),
      messages: params.messages,
      temperature: params.temperature || 1.0,
    };
    
    // Simple hash function (for lite version - not cryptographic)
    const str = JSON.stringify(normalized);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    const hashStr = Math.abs(hash).toString(36);
    return `lite:${this.namespace}:${params.provider}:${params.model}:${hashStr}`;
  }

  /**
   * Get cached response
   */
  async get<T = any>(params: {
    provider: string;
    model: string;
    messages: any[];
    temperature?: number;
  }): Promise<GetResult<T>> {
    this.stats.totalRequests++;
    
    const key = this.generateKey(params);
    const entry = this.cache.get(key);

    // Cache miss
    if (!entry) {
      this.stats.misses++;
      if (this.telemetry) this.checkUpgradeThreshold();
      return { hit: false };
    }

    // Check expiration
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.stats.misses++;
      return { hit: false };
    }

    // Cache hit!
    this.stats.hits++;
    entry.hits++;
    this.updateAccessOrder(key);

    const age = Math.floor((Date.now() - entry.createdAt) / 1000);

    return {
      hit: true,
      value: entry.value,
      age,
      namespace: this.namespace,
    };
  }

  /**
   * Store response in cache
   */
  async set<T = any>(
    params: {
      provider: string;
      model: string;
      messages: any[];
      temperature?: number;
    },
    value: T,
    options: SetOptions = {}
  ): Promise<void> {
    const key = this.generateKey(params);
    const ttl = options.ttl ? options.ttl * 1000 : this.defaultTTL;

    // Evict if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      value,
      expires: Date.now() + ttl,
      hits: 0,
      createdAt: Date.now(),
    };

    this.cache.set(key, entry);
    this.updateAccessOrder(key);
  }

  /**
   * Check if response is cached (without retrieving it)
   */
  async check(params: {
    provider: string;
    model: string;
    messages: any[];
    temperature?: number;
  }): Promise<{ cached: boolean; ttl?: number }> {
    const key = this.generateKey(params);
    const entry = this.cache.get(key);

    if (!entry) {
      return { cached: false };
    }

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      return { cached: false };
    }

    const ttl = Math.floor((entry.expires - Date.now()) / 1000);
    return { cached: true, ttl };
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const hitRate = this.stats.totalRequests > 0
      ? (this.stats.hits / this.stats.totalRequests) * 100
      : 0;

    // Rough memory estimate (very approximate)
    const avgEntrySize = 2048; // 2KB average
    const memoryBytes = this.cache.size * avgEntrySize;
    const memoryMB = (memoryBytes / 1024 / 1024).toFixed(2);

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: parseFloat(hitRate.toFixed(2)),
      evictions: this.stats.evictions,
      memoryEstimate: `${memoryMB} MB`,
    };
  }

  /**
   * Delete specific entry
   */
  delete(params: {
    provider: string;
    model: string;
    messages: any[];
    temperature?: number;
  }): boolean {
    const key = this.generateKey(params);
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.removeFromAccessOrder(key);
    }
    return deleted;
  }

  // ===== Private Methods =====

  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;
    
    const oldestKey = this.accessOrder.shift()!;
    this.cache.delete(oldestKey);
    this.stats.evictions++;
  }

  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  private checkUpgradeThreshold(): void {
    const stats = this.getStats();
    
    // Recommend upgrade when:
    // 1. Hit max capacity multiple times
    // 2. Good hit rate (>50%) - they're getting value
    // 3. High request volume (>1000 requests)
    
    if (
      this.stats.evictions > 10 &&
      stats.hitRate > 50 &&
      this.stats.totalRequests > 1000
    ) {
      console.log(
        '\n🚀 AgentCache Lite Tip: You\'re getting great cache performance!\n' +
        `   Hit rate: ${stats.hitRate}% across ${this.stats.totalRequests} requests\n` +
        '   Consider upgrading to AgentCache Standard for:\n' +
        '   • Redis persistence (survive restarts)\n' +
        '   • Unlimited cache size\n' +
        '   • Shared cache across instances\n' +
        '   • Only $29/month\n' +
        '   Learn more: https://agentcache.ai/pricing\n'
      );
    }
  }
}

/**
 * Convenience function for single-instance usage
 */
let defaultInstance: AgentCacheLite | null = null;

export function createCache(options?: CacheOptions): AgentCacheLite {
  return new AgentCacheLite(options);
}

export function getDefaultCache(options?: CacheOptions): AgentCacheLite {
  if (!defaultInstance) {
    defaultInstance = new AgentCacheLite(options);
  }
  return defaultInstance;
}

// Default export
export default AgentCacheLite;
