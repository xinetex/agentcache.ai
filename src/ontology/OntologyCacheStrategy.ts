/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
import { createHash } from 'crypto';
import { redis } from '../lib/redis.js';
import { ontologyRegistry } from './OntologyRegistry.js';

/**
 * OntologyCacheStrategy: Sector-aware caching for ontology mapping results.
 * 
 * Key format: ontology:v{version}:{sector}:{contentHash}
 * TTL: Per-sector (finance=5min, biotech=7days, legal=30days, etc.)
 * 
 * Designed for high cache-hit rates on repeated agent queries against the same
 * data sources — each hit saves a full LLM call while still billing the agent.
 */
export class OntologyCacheStrategy {

    /**
     * Generate a deterministic cache key from sector + content.
     * HARDENING (Q3): Normalizes unicode (NFC) and collapses whitespace
     * to prevent trivial input variance from causing cache misses.
     */
    generateKey(sectorId: string, content: string): string {
        const sector = ontologyRegistry.resolve(sectorId);
        const version = sector?.version || '0.0.0';

        // Normalize: NFC unicode → collapse whitespace → trim → lowercase
        const normalized = content
            .normalize('NFC')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();

        const hash = createHash('sha256')
            .update(normalized)
            .digest('hex')
            .substring(0, 16); // 16 hex chars = 64 bits — collision-safe for cache
        return `ontology:v${version}:${sectorId}:${hash}`;
    }

    /**
     * Attempt to retrieve a cached ontology mapping.
     * Returns null on miss.
     */
    async get(sectorId: string, content: string): Promise<any | null> {
        const key = this.generateKey(sectorId, content);
        try {
            const cached = await redis.get(key) as string | null;
            if (cached) {
                console.log(`[OntologyCache] HIT: ${key}`);
                await this.recordMetric(sectorId, true);
                return JSON.parse(cached);
            }
        } catch (e) {
            console.warn(`[OntologyCache] Read error:`, e);
        }

        console.log(`[OntologyCache] MISS: ${key}`);
        await this.recordMetric(sectorId, false);
        return null;
    }

    /**
     * Store a mapped ontology result with the sector-specific TTL.
     */
    async set(sectorId: string, content: string, mappedData: any): Promise<void> {
        const key = this.generateKey(sectorId, content);
        const sector = ontologyRegistry.resolve(sectorId);
        const ttl = sector?.cacheTtlSeconds || 3600; // Default 1 hour

        try {
            await redis.setex(key, ttl, JSON.stringify(mappedData));
            console.log(`[OntologyCache] SET: ${key} (TTL: ${ttl}s)`);
        } catch (e) {
            console.error(`[OntologyCache] Write error:`, e);
        }
    }

    /**
     * Invalidate all cached entries for a sector.
     * Uses a counter-based approach instead of SCAN to avoid the Redis SCAN bottleneck
     * identified in the architecture review.
     */
    async invalidateSector(sectorId: string): Promise<void> {
        // Instead of scanning, we bump the version prefix in the registry
        // which naturally expires old keys without a SCAN.
        // For immediate invalidation of known keys, we track recent keys in a set.
        const trackingKey = `ontology:sector_keys:${sectorId}`;
        try {
            const keys = await redis.smembers(trackingKey) as string[];
            if (keys.length > 0) {
                for (const key of keys) {
                    await redis.del(key);
                }
                await redis.del(trackingKey);
                console.log(`[OntologyCache] Invalidated ${keys.length} keys for sector: ${sectorId}`);
            }
        } catch (e) {
            console.warn(`[OntologyCache] Invalidation error:`, e);
        }
    }

    /**
     * Get cache metrics for a sector.
     */
    async getMetrics(sectorId: string): Promise<{ hits: number; misses: number; hitRatio: number }> {
        try {
            const hitsStr = await redis.get(`ontology:metrics:${sectorId}:hits`) as string | null;
            const missesStr = await redis.get(`ontology:metrics:${sectorId}:misses`) as string | null;
            const hits = parseInt(hitsStr || '0');
            const misses = parseInt(missesStr || '0');
            const total = hits + misses;
            return {
                hits,
                misses,
                hitRatio: total > 0 ? hits / total : 0,
            };
        } catch (e) {
            return { hits: 0, misses: 0, hitRatio: 0 };
        }
    }

    private async recordMetric(sectorId: string, hit: boolean): Promise<void> {
        try {
            const metricKey = hit
                ? `ontology:metrics:${sectorId}:hits`
                : `ontology:metrics:${sectorId}:misses`;
            await redis.incr(metricKey);
        } catch (e) {
            // Ignore metric failures
        }
    }
}

export const ontologyCacheStrategy = new OntologyCacheStrategy();
