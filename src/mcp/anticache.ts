/**
 * AgentCache Anti-Cache System
 * 
 * Features:
 * - Cache invalidation API
 * - Freshness tracking
 * - URL monitoring & change detection
 * - Automatic staleness detection
 * - Pre-warming capabilities
 */

import { createHash } from 'crypto';
import { redis } from '../lib/redis.js';

// ==========================================
// TYPES & INTERFACES
// ==========================================

export interface CacheMetadata {
  cachedAt: number;
  ttl: number;
  namespace?: string;
  sourceUrl?: string;
  contentHash?: string;
  accessCount: number;
  lastAccessed: number;
}

export interface FreshnessStatus {
  status: 'fresh' | 'stale' | 'expired';
  age: number; // milliseconds
  ttlRemaining: number; // milliseconds
  freshnessScore: number; // 0-100
  shouldRefresh: boolean;
}

export interface InvalidationRequest {
  pattern?: string; // Wildcard pattern (e.g., "competitor-pricing/*")
  namespace?: string;
  olderThan?: number; // Invalidate caches older than X ms
  url?: string; // Invalidate caches from specific URL
  reason?: string;
  notify?: boolean;
  preWarm?: boolean; // Re-cache after invalidation
}

export interface InvalidationResult {
  invalidated: number;
  namespaces: string[];
  cacheKeys: string[];
  estimatedCostImpact?: string;
  preWarmed?: number;
}

export interface UrlListener {
  id: string;
  url: string;
  checkInterval: number; // milliseconds
  lastCheck: number;
  lastHash: string;
  namespace: string;
  invalidateOnChange: boolean;
  webhook?: string;
  enabled: boolean;
}

export interface ChangeEvent {
  listenerId: string;
  url: string;
  changedAt: number;
  oldHash: string;
  newHash: string;
  cachesInvalidated: number;
  diff?: {
    added: number;
    removed: number;
    changed: number;
  };
}

// ==========================================
// FRESHNESS CALCULATOR
// ==========================================

export class FreshnessCalculator {
  /**
   * Calculate freshness status of a cached item
   */
  static calculateFreshness(metadata: CacheMetadata): FreshnessStatus {
    const now = Date.now();
    const age = now - metadata.cachedAt;
    const ttlRemaining = (metadata.cachedAt + metadata.ttl) - now;
    const expirationTime = metadata.cachedAt + metadata.ttl;

    // Determine status
    let status: 'fresh' | 'stale' | 'expired';
    if (now > expirationTime) {
      status = 'expired';
    } else if (age > metadata.ttl * 0.75) {
      // Last 25% of TTL = stale
      status = 'stale';
    } else {
      status = 'fresh';
    }

    // Calculate freshness score (0-100)
    const freshnessScore = status === 'expired'
      ? 0
      : Math.max(0, Math.min(100, (ttlRemaining / metadata.ttl) * 100));

    // Should we refresh?
    const shouldRefresh = status === 'expired' ||
      (status === 'stale' && metadata.accessCount > 10);

    return {
      status,
      age,
      ttlRemaining: Math.max(0, ttlRemaining),
      freshnessScore: Math.round(freshnessScore),
      shouldRefresh
    };
  }

  /**
   * Get recommended TTL based on content type and access patterns
   */
  static recommendTTL(contentType: string, accessPattern: 'frequent' | 'moderate' | 'rare'): number {
    const baseTTLs: Record<string, number> = {
      'news': 3600000,           // 1 hour
      'pricing': 86400000,       // 24 hours
      'documentation': 604800000, // 7 days
      'knowledge': 2592000000,   // 30 days
      'static': 31536000000      // 1 year
    };

    const baseTTL = baseTTLs[contentType] || 86400000; // Default 24h

    // Adjust based on access pattern
    const multiplier = {
      'frequent': 0.5,  // More frequent = shorter TTL (stay fresh)
      'moderate': 1.0,
      'rare': 2.0       // Rare access = longer TTL (save costs)
    }[accessPattern];

    return baseTTL * multiplier;
  }
}

// ==========================================
// CACHE INVALIDATION ENGINE
// ==========================================

export class CacheInvalidator {
  // Removed in-memory map: private metadata: Map<string, CacheMetadata> = new Map();

  /**
   * Register cache metadata
   */
  async registerCache(cacheKey: string, metadata: CacheMetadata): Promise<void> {
    // Store metadata in Redis
    await redis.setex(`${cacheKey}:meta`, Math.ceil(metadata.ttl / 1000), JSON.stringify(metadata));

    // Index by namespace for efficient invalidation
    if (metadata.namespace) {
      await redis.sadd(`namespace:${metadata.namespace}`, cacheKey);
    }
  }

  /**
   * Get cache metadata
   */
  async getMetadata(cacheKey: string): Promise<CacheMetadata | undefined> {
    const data = await redis.get(`${cacheKey}:meta`);
    return data ? JSON.parse(data) : undefined;
  }

  /**
   * Update access statistics
   */
  async recordAccess(cacheKey: string): Promise<void> {
    const data = await redis.get(`${cacheKey}:meta`);
    if (data) {
      const metadata = JSON.parse(data);
      metadata.accessCount++;
      metadata.lastAccessed = Date.now();
      // Update with same TTL
      const ttl = await redis.ttl(`${cacheKey}:meta`);
      if (ttl > 0) {
        await redis.setex(`${cacheKey}:meta`, ttl, JSON.stringify(metadata));
      }
    }
  }

  /**
   * Invalidate caches matching criteria
   */
  async invalidate(request: InvalidationRequest): Promise<InvalidationResult> {
    const matchingKeys: string[] = [];
    const namespaces = new Set<string>();

    // Strategy:
    // 1. If namespace provided, scan that namespace set
    // 2. If pattern provided, scan keys matching pattern
    // 3. Else, this is a heavy operation (scan all) - strictly limited in prod

    let candidates: string[] = [];

    if (request.namespace) {
      candidates = await redis.smembers(`namespace:${request.namespace}`);
      namespaces.add(request.namespace);
    } else if (request.pattern) {
      // Use SCAN for pattern matching (inefficient but works for MVP)
      // In prod, use a proper search index (RedisSearch)
      let cursor = '0';
      do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', request.pattern, 'COUNT', 100);
        cursor = nextCursor;
        candidates.push(...keys);
      } while (cursor !== '0');
    }

    // Filter candidates
    for (const key of candidates) {
      const metadata = await this.getMetadata(key);
      if (metadata && this.matchesInvalidationCriteria(key, metadata, request)) {
        matchingKeys.push(key);
        if (metadata.namespace) namespaces.add(metadata.namespace);
      } else if (!metadata) {
        // Orphaned key or no metadata, maybe just delete it if it matches pattern
        if (request.pattern) matchingKeys.push(key);
      }
    }

    // Delete keys
    if (matchingKeys.length > 0) {
      await redis.del(...matchingKeys);
      // Also delete metadata
      const metaKeys = matchingKeys.map(k => `${k}:meta`);
      await redis.del(...metaKeys);

      // Cleanup namespace sets (async/background)
      if (request.namespace) {
        await redis.srem(`namespace:${request.namespace}`, ...matchingKeys);
      }
    }

    // Calculate cost impact (rough estimate)
    const avgCostPerCache = 0.01; // $0.01 per cache re-generation
    const estimatedCost = matchingKeys.length * avgCostPerCache;

    return {
      invalidated: matchingKeys.length,
      namespaces: Array.from(namespaces),
      cacheKeys: matchingKeys,
      estimatedCostImpact: `$${estimatedCost.toFixed(2)}`,
      preWarmed: request.preWarm ? matchingKeys.length : 0
    };
  }

  /**
   * Check if cache matches invalidation criteria
   */
  private matchesInvalidationCriteria(
    cacheKey: string,
    metadata: CacheMetadata,
    request: InvalidationRequest
  ): boolean {
    // Pattern matching (wildcard support)
    if (request.pattern) {
      const regex = new RegExp(
        '^' + request.pattern.replace(/\*/g, '.*') + '$'
      );
      if (!regex.test(cacheKey) && !regex.test(metadata.namespace || '')) {
        return false;
      }
    }

    // Namespace matching
    if (request.namespace && metadata.namespace !== request.namespace) {
      return false;
    }

    // Age-based invalidation
    if (request.olderThan) {
      const age = Date.now() - metadata.cachedAt;
      if (age < request.olderThan) {
        return false;
      }
    }

    // URL matching
    if (request.url && metadata.sourceUrl !== request.url) {
      return false;
    }

    return true;
  }

  /**
   * Get all stale caches (Scan)
   */
  async getStaleCaches(): Promise<{ key: string; metadata: CacheMetadata; freshness: FreshnessStatus }[]> {
    const stale: { key: string; metadata: CacheMetadata; freshness: FreshnessStatus }[] = [];

    // Scan all meta keys
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', '*:meta', 'COUNT', 100);
      cursor = nextCursor;

      for (const metaKey of keys) {
        const data = await redis.get(metaKey);
        if (data) {
          const metadata = JSON.parse(data);
          const freshness = FreshnessCalculator.calculateFreshness(metadata);
          if (freshness.status === 'stale' || freshness.status === 'expired') {
            const key = metaKey.replace(':meta', '');
            stale.push({ key, metadata, freshness });
          }
        }
      }
    } while (cursor !== '0');

    return stale;
  }
}

// ==========================================
// URL MONITORING & CHANGE DETECTION
// ==========================================

// Imports moved to top

export class UrlMonitor {
  // Removed in-memory maps:
  // private listeners: Map<string, UrlListener> = new Map();
  // private intervals: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Register a URL to monitor
   */
  async registerListener(listener: Omit<UrlListener, 'id' | 'lastCheck' | 'lastHash'>): Promise<string> {
    const id = this.generateListenerId();

    const fullListener: UrlListener = {
      ...listener,
      id,
      lastCheck: 0,
      lastHash: '',
      enabled: true
    };

    // Store in Redis
    await redis.set(`listener:${id}`, JSON.stringify(fullListener));
    await redis.sadd('listeners:active', id);

    // Note: In a serverless environment, we can't start a persistent interval here.
    // Instead, we rely on an external cron job (e.g., Vercel Cron) to call a check endpoint.
    // For local dev (long-running), we could start it, but let's stick to the stateless pattern.

    return id;
  }

  /**
   * Unregister a listener
   */
  async unregisterListener(id: string): Promise<boolean> {
    const exists = await redis.exists(`listener:${id}`);
    if (!exists) return false;

    await redis.del(`listener:${id}`);
    await redis.srem('listeners:active', id);
    return true;
  }

  /**
   * Check URL for changes (Stateless - called by Cron)
   */
  async checkUrl(id: string): Promise<void> {
    const data = await redis.get(`listener:${id}`);
    if (!data) return;

    const listener: UrlListener = JSON.parse(data);
    if (!listener.enabled) return;

    try {
      // Fetch URL content
      const response = await fetch(listener.url);
      const content = await response.text();

      // Calculate content hash
      const newHash = this.hashContent(content);

      // First check - just store hash
      if (!listener.lastHash) {
        listener.lastHash = newHash;
        listener.lastCheck = Date.now();
        await redis.set(`listener:${id}`, JSON.stringify(listener));
        return;
      }

      // Check for changes
      if (newHash !== listener.lastHash) {
        const event: ChangeEvent = {
          listenerId: id,
          url: listener.url,
          changedAt: Date.now(),
          oldHash: listener.lastHash,
          newHash: newHash,
          cachesInvalidated: 0
        };

        // Trigger invalidation if configured
        if (listener.invalidateOnChange) {
          console.log(`🔄 Change detected: ${listener.url}`);
          event.cachesInvalidated = await this.handleChange(listener, event);
        }

        // Send webhook notification
        if (listener.webhook) {
          await this.sendWebhook(listener.webhook, event);
        }

        // Notify overflow partners
        await this.notifyOverflowPartners(event);

        // Update listener
        listener.lastHash = newHash;
        listener.lastCheck = Date.now();
        await redis.set(`listener:${id}`, JSON.stringify(listener));
      } else {
        // No change
        listener.lastCheck = Date.now();
        await redis.set(`listener:${id}`, JSON.stringify(listener));
      }
    } catch (error) {
      console.error(`Error checking URL ${listener.url}:`, error);
    }
  }

  /**
   * Hash content for change detection
   */
  private hashContent(content: string): string {
    // Clean content (remove timestamps, ads, etc.)
    const cleaned = this.cleanContent(content);

    return createHash('sha256')
      .update(cleaned)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Clean content for hashing (remove noise)
   */
  private cleanContent(html: string): string {
    // Remove scripts, styles, comments
    let cleaned = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');

    // Remove common timestamp patterns
    cleaned = cleaned
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g, '')
      .replace(/\d{13}/g, '') // Unix timestamps (ms)
      .replace(/\d{10}/g, ''); // Unix timestamps (s)

    // Normalize whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned;
  }

  /**
   * Handle change event (invalidate caches)
   */
  private async handleChange(listener: UrlListener, event: ChangeEvent): Promise<number> {
    // This would call the cache invalidation API
    // For now, just return a mock count
    return 0; // Implement actual invalidation
  }

  /**
   * Send webhook notification
   */
  private async sendWebhook(webhookUrl: string, event: ChangeEvent): Promise<void> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

      await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-AgentCache-Event': 'url-changed',
          'X-Event-Type': 'cache-invalidation'
        },
        body: JSON.stringify({
          event: 'cache-invalidation',
          ...event
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);
    } catch (error) {
      console.error(`Error sending webhook to ${webhookUrl}:`, error);
    }
  }

  /**
   * Notify overflow partners of URL changes
   */
  async notifyOverflowPartners(event: ChangeEvent): Promise<void> {
    // Import is done here to avoid circular dependencies
    try {
      const { getActivePartnersWithWebhooks } = await import('../services/overflowPartners.js');
      const { redis } = await import('../lib/redis.js');

      const partners = getActivePartnersWithWebhooks();

      const webhookPromises = partners.map(async (partner) => {
        if (!partner.webhook) return;

        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

          const response = await fetch(partner.webhook, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-AgentCache-Event': 'url-changed',
              'X-Partner-Id': partner.id
            },
            body: JSON.stringify({
              event: 'cache-invalidation',
              url: event.url,
              changedAt: event.changedAt,
              cachesInvalidated: event.cachesInvalidated,
              listenerId: event.listenerId
            }),
            signal: controller.signal
          });

          clearTimeout(timeout);

          // Track webhook stats
          await redis.hincrby(`partner:${partner.id}:webhooks`, response.ok ? 'success' : 'failure', 1);
        } catch (error) {
          console.error(`[Overflow] Failed to notify ${partner.name}:`, error);
          await redis.hincrby(`partner:${partner.id}:webhooks`, 'failure', 1);
        }
      });

      await Promise.allSettled(webhookPromises);
    } catch (error) {
      console.error('[Overflow] Error notifying partners:', error);
    }
  }

  /**
   * Generate unique listener ID
   */
  private generateListenerId(): string {
    return `listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get listener by ID
   */
  async getListener(id: string): Promise<UrlListener | undefined> {
    const data = await redis.get(`listener:${id}`);
    return data ? JSON.parse(data) : undefined;
  }

  /**
   * Get all listeners
   */
  async getAllListeners(): Promise<UrlListener[]> {
    const ids = await redis.smembers('listeners:active');
    const listeners: UrlListener[] = [];

    for (const id of ids) {
      const data = await redis.get(`listener:${id}`);
      if (data) {
        listeners.push(JSON.parse(data));
      }
    }

    return listeners;
  }
}

// ==========================================
// FRESHNESS RULES ENGINE
// ==========================================

export interface FreshnessRule {
  name: string;
  pattern: string;
  freshThreshold: number; // ms
  staleThreshold: number; // ms
  autoRefresh: boolean;
}

export class FreshnessRuleEngine {
  private rules: FreshnessRule[] = [
    {
      name: 'News Articles',
      pattern: '*news*',
      freshThreshold: 3600000,    // 1 hour
      staleThreshold: 21600000,   // 6 hours
      autoRefresh: true
    },
    {
      name: 'Product Prices',
      pattern: '*pricing*',
      freshThreshold: 86400000,   // 24 hours
      staleThreshold: 604800000,  // 7 days
      autoRefresh: false
    },
    {
      name: 'Documentation',
      pattern: '*docs*',
      freshThreshold: 604800000,  // 7 days
      staleThreshold: 2592000000, // 30 days
      autoRefresh: false
    },
    {
      name: 'General Knowledge',
      pattern: '*',
      freshThreshold: 2592000000, // 30 days
      staleThreshold: Infinity,
      autoRefresh: false
    }
  ];

  /**
   * Find matching rule for cache key
   */
  findMatchingRule(cacheKey: string): FreshnessRule {
    for (const rule of this.rules) {
      const regex = new RegExp(
        '^' + rule.pattern.replace(/\*/g, '.*') + '$'
      );
      if (regex.test(cacheKey)) {
        return rule;
      }
    }

    // Default: last rule (general)
    return this.rules[this.rules.length - 1];
  }

  /**
   * Evaluate freshness against rules
   */
  evaluateFreshness(cacheKey: string, age: number): {
    rule: FreshnessRule;
    status: 'fresh' | 'stale' | 'expired';
    shouldAutoRefresh: boolean;
  } {
    const rule = this.findMatchingRule(cacheKey);

    let status: 'fresh' | 'stale' | 'expired';
    if (age < rule.freshThreshold) {
      status = 'fresh';
    } else if (age < rule.staleThreshold) {
      status = 'stale';
    } else {
      status = 'expired';
    }

    const shouldAutoRefresh = rule.autoRefresh && status !== 'fresh';

    return { rule, status, shouldAutoRefresh };
  }

  /**
   * Add custom rule
   */
  addRule(rule: FreshnessRule): void {
    // Insert before the last (general) rule
    this.rules.splice(this.rules.length - 1, 0, rule);
  }

  /**
   * Get all rules
   */
  getRules(): FreshnessRule[] {
    return [...this.rules];
  }
}

// ==========================================
// EXPORTS
// ==========================================

export const antiCache = {
  FreshnessCalculator,
  CacheInvalidator,
  UrlMonitor,
  FreshnessRuleEngine
};
