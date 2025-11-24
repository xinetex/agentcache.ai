/**
 * AgentCache Standard
 * Production-grade AI response caching with Redis persistence
 * 
 * Drop-in upgrade from @agentcache/lite with the same API
 */

import { HttpClient } from './http';
import {
  AgentCacheConfig,
  CacheParams,
  GetResult,
  SetOptions,
  CheckResult,
  CacheStats,
  AgentCacheError,
} from './types';

export class AgentCache {
  private client: HttpClient;
  private namespace?: string;

  constructor(config: AgentCacheConfig) {
    if (!config.apiKey) {
      throw new AgentCacheError('API key is required');
    }

    if (!config.apiKey.startsWith('ac_')) {
      throw new AgentCacheError(
        'Invalid API key format. Keys must start with "ac_demo_" or "ac_live_"'
      );
    }

    this.namespace = config.namespace;
    this.client = new HttpClient(
      config.apiKey,
      config.endpoint || 'https://agentcache.ai',
      config.namespace,
      config.timeout || 10000
    );
  }

  /**
   * Get cached AI response
   * 
   * @example
   * ```typescript
   * const result = await cache.get({
   *   provider: 'openai',
   *   model: 'gpt-4',
   *   messages: [{ role: 'user', content: 'Hello' }]
   * });
   * 
   * if (result.hit) {
   *   console.log('Cache hit!', result.value);
   * } else {
   *   // Call your LLM provider
   * }
   * ```
   */
  async get<T = any>(params: CacheParams): Promise<GetResult<T>> {
    try {
      const response = await this.client.post<any>('/api/cache/get', params);
      
      // Backend returns 404 with {hit: false} for cache miss
      // or 200 with {hit: true, response: ...} for cache hit
      if (response.hit) {
        return {
          hit: true,
          value: response.response as T,
          age: response.age,
          namespace: response.namespace || this.namespace,
          latency: response.latency,
        };
      }

      return {
        hit: false,
        latency: response.latency,
      };
    } catch (error: any) {
      // 404 means cache miss - return gracefully
      if (error instanceof AgentCacheError && error.statusCode === 404) {
        return { hit: false };
      }
      throw error;
    }
  }

  /**
   * Store AI response in cache
   * 
   * @example
   * ```typescript
   * await cache.set(
   *   {
   *     provider: 'openai',
   *     model: 'gpt-4',
   *     messages: [{ role: 'user', content: 'Hello' }]
   *   },
   *   response,
   *   { ttl: 3600 } // Optional: 1 hour TTL
   * );
   * ```
   */
  async set<T = any>(
    params: CacheParams,
    value: T,
    options: SetOptions = {}
  ): Promise<void> {
    await this.client.post('/api/cache/set', {
      ...params,
      response: value,
      ttl: options.ttl,
    });
  }

  /**
   * Check if response is cached (without retrieving it)
   * 
   * @example
   * ```typescript
   * const { cached, ttl } = await cache.check({
   *   provider: 'openai',
   *   model: 'gpt-4',
   *   messages: [{ role: 'user', content: 'Hello' }]
   * });
   * 
   * console.log(`Cached: ${cached}, TTL: ${ttl}s`);
   * ```
   */
  async check(params: CacheParams): Promise<CheckResult> {
    try {
      const response = await this.client.post<any>('/api/cache/check', params);
      return {
        cached: response.cached || false,
        ttl: response.ttl,
      };
    } catch (error: any) {
      // 404 means not cached
      if (error instanceof AgentCacheError && error.statusCode === 404) {
        return { cached: false };
      }
      throw error;
    }
  }

  /**
   * Get cache performance statistics
   * 
   * @param period Time period: '1h', '24h', '7d', '30d' (default: '24h')
   * 
   * @example
   * ```typescript
   * const stats = await cache.getStats('7d');
   * 
   * console.log(`Hit rate: ${stats.metrics.hit_rate}%`);
   * console.log(`Cost saved: ${stats.metrics.cost_saved}`);
   * console.log(`Requests: ${stats.metrics.total_requests}`);
   * ```
   */
  async getStats(period: string = '24h'): Promise<CacheStats> {
    const params: Record<string, string> = { period };
    
    if (this.namespace) {
      params.namespace = this.namespace;
    }

    return await this.client.get<CacheStats>('/api/stats', params);
  }

  /**
   * Clear all cached entries (requires admin privileges)
   * 
   * @experimental This may not be available on all tiers
   */
  async clear(): Promise<void> {
    await this.client.post('/api/cache/clear', {});
  }

  /**
   * Delete specific cache entry
   * 
   * @experimental This may not be available on all tiers
   */
  async delete(params: CacheParams): Promise<boolean> {
    try {
      await this.client.post('/api/cache/delete', params);
      return true;
    } catch (error: any) {
      if (error instanceof AgentCacheError && error.statusCode === 404) {
        return false;
      }
      throw error;
    }
  }
}

// Export types
export type {
  AgentCacheConfig,
  CacheParams,
  Message,
  GetResult,
  SetOptions,
  CheckResult,
  CacheStats,
} from './types';

export { AgentCacheError } from './types';

// Export HTTP client for advanced use cases
export { HttpClient } from './http';

// Default export
export default AgentCache;
