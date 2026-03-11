
import { redis } from '../lib/redis.js';
import { createHash } from 'crypto';

export interface CacheCheckResult {
    cached: boolean;
    response?: string;
    key?: string;
    coherence?: number;
    savedUsd?: number;
}

/**
 * SemanticCacheService: Hierarchical memory for LLM swarms.
 * L1 (Local SDK - Handled by client)
 * L2 (Distributed Redis - Handled here)
 */
export class SemanticCacheService {
    
    /**
     * Generate a deterministic but semantic-aware key for a message history.
     * Simple implementation: Hash of the normalized message content.
     */
    static generateKey(messages: any[]): string {
        const normalized = messages
            .map(m => `${m.role}:${m.content.trim()}`)
            .join('|');
        return createHash('sha256').update(normalized).digest('hex');
    }

    /**
     * Check L2 (Redis) for a cached response.
     */
    async check(params: { messages: any[]; model: string; semantic?: boolean }): Promise<CacheCheckResult> {
        const key = SemanticCacheService.generateKey(params.messages);
        const cacheKey = `cache:llm:${key}`;

        const cachedResponse = await redis.get(cacheKey);
        
        if (cachedResponse) {
            // Record a hit globally
            await redis.incr('stats:total_hits');
            await redis.incrbyfloat('stats:total_savings_usd', 0.05); // Standard $0.05 per hit

            return {
                cached: true,
                response: String(cachedResponse),
                key,
                savedUsd: 0.05,
                coherence: 1.0 // Simple hit is perfectly coherent
            };
        }

        return { cached: false, key };
    }

    /**
     * Store a response in L2.
     */
    async set(key: string, response: string, ttl: number = 604800): Promise<void> {
        const cacheKey = `cache:llm:${key}`;
        await redis.setex(cacheKey, ttl, response);
    }

    /**
     * Get global savings stats
     */
    async getGlobalStats() {
        const hits = await redis.get('stats:total_hits') || "0";
        const savings = await redis.get('stats:total_savings_usd') || "0";
        return {
            hits: parseInt(hits as string),
            totalSavingsUsd: parseFloat(savings as string)
        };
    }
}

export const semanticCacheService = new SemanticCacheService();
