/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
/**
 * Context Layer - High-velocity KV storage for working memory
 * 
 * Designed for sub-10ms retrieval of hot context
 * Backends: Upstash Redis (production), In-memory LRU (dev)
 */

import { Redis } from '@upstash/redis';

interface CacheEntry {
  value: string;
  expiry?: number;
}

export class ContextLayer {
  private redis: Redis | null = null;
  private localCache = new Map<string, CacheEntry>();
  private maxLocalSize = 10000; // LRU limit
  private accessOrder: string[] = [];

  constructor() {
    this.initializeRedis();
  }

  private initializeRedis(): void {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (url && token) {
      try {
        this.redis = new Redis({ url, token });
        console.log('[ContextLayer] Connected to Upstash Redis');
      } catch (error) {
        console.warn('[ContextLayer] Redis init failed, using local cache:', error);
      }
    } else {
      console.warn('[ContextLayer] No Redis credentials, using local cache');
    }
  }

  /**
   * Set value with optional TTL
   */
  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (this.redis) {
      if (ttl) {
        await this.redis.setex(key, ttl, value);
      } else {
        await this.redis.set(key, value);
      }
    }

    // Always cache locally for speed
    this.localSet(key, value, ttl);
  }

  /**
   * Get value - local first, then remote
   */
  async get(key: string): Promise<string | null> {
    // Check local first (sub-ms)
    const local = this.localGet(key);
    if (local !== null) {
      return local;
    }

    // Fall back to Redis
    if (this.redis) {
      const value = await this.redis.get<string>(key);
      if (value !== null) {
        // Backfill local cache
        this.localSet(key, value);
      }
      return value;
    }

    return null;
  }

  /**
   * Delete value
   */
  async delete(key: string): Promise<void> {
    if (this.redis) {
      await this.redis.del(key);
    }
    this.localCache.delete(key);
    this.accessOrder = this.accessOrder.filter(k => k !== key);
  }

  /**
   * Check existence
   */
  async exists(key: string): Promise<boolean> {
    if (this.localCache.has(key)) {
      const entry = this.localCache.get(key)!;
      if (!entry.expiry || entry.expiry > Date.now()) {
        return true;
      }
    }

    if (this.redis) {
      return (await this.redis.exists(key)) > 0;
    }

    return false;
  }

  /**
   * Get multiple keys
   */
  async mget(keys: string[]): Promise<Map<string, string | null>> {
    const result = new Map<string, string | null>();
    const missedKeys: string[] = [];

    // Check local first
    for (const key of keys) {
      const local = this.localGet(key);
      if (local !== null) {
        result.set(key, local);
      } else {
        missedKeys.push(key);
      }
    }

    // Fetch missed from Redis
    if (this.redis && missedKeys.length > 0) {
      const values = await this.redis.mget<string[]>(...missedKeys);
      for (let i = 0; i < missedKeys.length; i++) {
        const value = values[i];
        result.set(missedKeys[i], value);
        if (value !== null) {
          this.localSet(missedKeys[i], value);
        }
      }
    }

    return result;
  }

  /**
   * Set multiple keys
   */
  async mset(entries: Map<string, string>, ttl?: number): Promise<void> {
    if (this.redis) {
      const pipeline = this.redis.pipeline();
      for (const [key, value] of Array.from(entries)) {
        if (ttl) {
          pipeline.setex(key, ttl, value);
        } else {
          pipeline.set(key, value);
        }
      }
      await pipeline.exec();
    }

    // Update local cache
    for (const [key, value] of Array.from(entries)) {
      this.localSet(key, value, ttl);
    }
  }

  /**
   * Increment counter
   */
  async incr(key: string): Promise<number> {
    if (this.redis) {
      return this.redis.incr(key);
    }

    const current = parseInt(this.localGet(key) || '0', 10);
    const next = current + 1;
    this.localSet(key, next.toString());
    return next;
  }

  /**
   * Get all keys matching pattern (local only for performance)
   */
  keys(pattern: string): string[] {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return Array.from(this.localCache.keys()).filter(k => regex.test(k));
  }

  // ==========================================================================
  // LOCAL CACHE (LRU)
  // ==========================================================================

  private localSet(key: string, value: string, ttl?: number): void {
    // Evict if at capacity
    while (this.localCache.size >= this.maxLocalSize) {
      const oldest = this.accessOrder.shift();
      if (oldest) {
        this.localCache.delete(oldest);
      }
    }

    const entry: CacheEntry = {
      value,
      expiry: ttl ? Date.now() + ttl * 1000 : undefined,
    };

    this.localCache.set(key, entry);
    this.touchAccess(key);
  }

  private localGet(key: string): string | null {
    const entry = this.localCache.get(key);
    if (!entry) return null;

    // Check expiry
    if (entry.expiry && entry.expiry < Date.now()) {
      this.localCache.delete(key);
      return null;
    }

    this.touchAccess(key);
    return entry.value;
  }

  private touchAccess(key: string): void {
    this.accessOrder = this.accessOrder.filter(k => k !== key);
    this.accessOrder.push(key);
  }

  /**
   * Get cache stats
   */
  stats(): { local: number; maxLocal: number } {
    return {
      local: this.localCache.size,
      maxLocal: this.maxLocalSize,
    };
  }
}

export default ContextLayer;
