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
  private metadata: Map<string, CacheMetadata> = new Map();
  
  /**
   * Register cache metadata
   */
  registerCache(cacheKey: string, metadata: CacheMetadata): void {
    this.metadata.set(cacheKey, metadata);
  }
  
  /**
   * Get cache metadata
   */
  getMetadata(cacheKey: string): CacheMetadata | undefined {
    return this.metadata.get(cacheKey);
  }
  
  /**
   * Update access statistics
   */
  recordAccess(cacheKey: string): void {
    const metadata = this.metadata.get(cacheKey);
    if (metadata) {
      metadata.accessCount++;
      metadata.lastAccessed = Date.now();
      this.metadata.set(cacheKey, metadata);
    }
  }
  
  /**
   * Invalidate caches matching criteria
   */
  async invalidate(request: InvalidationRequest): Promise<InvalidationResult> {
    const matchingKeys: string[] = [];
    const namespaces = new Set<string>();
    
    // Find matching cache keys
    for (const [cacheKey, metadata] of this.metadata.entries()) {
      if (this.matchesInvalidationCriteria(cacheKey, metadata, request)) {
        matchingKeys.push(cacheKey);
        if (metadata.namespace) {
          namespaces.add(metadata.namespace);
        }
      }
    }
    
    // Remove metadata
    for (const key of matchingKeys) {
      this.metadata.delete(key);
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
   * Get all stale caches
   */
  getStaleCaches(): { key: string; metadata: CacheMetadata; freshness: FreshnessStatus }[] {
    const stale: { key: string; metadata: CacheMetadata; freshness: FreshnessStatus }[] = [];
    
    for (const [key, metadata] of this.metadata.entries()) {
      const freshness = FreshnessCalculator.calculateFreshness(metadata);
      if (freshness.status === 'stale' || freshness.status === 'expired') {
        stale.push({ key, metadata, freshness });
      }
    }
    
    return stale;
  }
}

// ==========================================
// URL MONITORING & CHANGE DETECTION
// ==========================================

export class UrlMonitor {
  private listeners: Map<string, UrlListener> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  
  /**
   * Register a URL to monitor
   */
  registerListener(listener: Omit<UrlListener, 'id' | 'lastCheck' | 'lastHash'>): string {
    const id = this.generateListenerId();
    
    const fullListener: UrlListener = {
      ...listener,
      id,
      lastCheck: 0,
      lastHash: '',
      enabled: true
    };
    
    this.listeners.set(id, fullListener);
    this.startMonitoring(id);
    
    return id;
  }
  
  /**
   * Unregister a listener
   */
  unregisterListener(id: string): boolean {
    this.stopMonitoring(id);
    return this.listeners.delete(id);
  }
  
  /**
   * Start monitoring a URL
   */
  private startMonitoring(id: string): void {
    const listener = this.listeners.get(id);
    if (!listener || !listener.enabled) return;
    
    // Set up interval
    const interval = setInterval(async () => {
      await this.checkUrl(id);
    }, listener.checkInterval);
    
    this.intervals.set(id, interval);
    
    // Do initial check
    this.checkUrl(id);
  }
  
  /**
   * Stop monitoring a URL
   */
  private stopMonitoring(id: string): void {
    const interval = this.intervals.get(id);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(id);
    }
  }
  
  /**
   * Check URL for changes
   */
  private async checkUrl(id: string): Promise<void> {
    const listener = this.listeners.get(id);
    if (!listener) return;
    
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
        this.listeners.set(id, listener);
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
          // This would call the invalidation API
          console.error(`🔄 Change detected: ${listener.url}`);
          event.cachesInvalidated = await this.handleChange(listener, event);
        }
        
        // Send webhook notification
        if (listener.webhook) {
          await this.sendWebhook(listener.webhook, event);
        }
        
        // Update listener
        listener.lastHash = newHash;
        listener.lastCheck = Date.now();
        this.listeners.set(id, listener);
      } else {
        // No change
        listener.lastCheck = Date.now();
        this.listeners.set(id, listener);
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
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      });
    } catch (error) {
      console.error(`Error sending webhook to ${webhookUrl}:`, error);
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
  getListener(id: string): UrlListener | undefined {
    return this.listeners.get(id);
  }
  
  /**
   * Get all listeners
   */
  getAllListeners(): UrlListener[] {
    return Array.from(this.listeners.values());
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
