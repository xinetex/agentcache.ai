
import { redis } from '../lib/redis.js';
import { createHash } from 'crypto';
import { stableHash } from '../lib/stable-json.js';
import { cognitiveMemory } from './cognitive-memory.js';

export interface CacheCheckResult {
    cached: boolean;
    hit?: boolean; // For compat
    response?: string;
    key?: string;
    coherence?: number;
    savedUsd?: number;
    ttl?: number;
    type?: string;
    similarity?: number;
    predictive_prefetch?: any[];
}

/**
 * SemanticCacheService: Hierarchical memory for LLM swarms.
 * L1 (Local SDK - Handled by client)
 * L2 (Distributed Redis - Handled here)
 * 
 * Re-aligned with Phase 3 Cognitive/Predictive logic to satisfy contract tests.
 */
export class SemanticCacheService {
    
    /**
     * Generate a deterministic but semantic-aware key for a message history.
     * Aligned with legacy "v1" stableHash format for backward compatibility.
     */
    static generateKey(params: { provider: string; model: string; messages: any[]; temperature?: number }): string {
        const data = {
            provider: params.provider || 'openai',
            model: params.model,
            messages: params.messages,
            temperature: params.temperature ?? 0.7,
        };
        const hash = stableHash(data);
        return `agentcache:v1:${data.provider}:${data.model}:${hash}`;
    }

    /**
     * Check L2 (Redis) for a cached response.
     */
    async check(params: { 
        messages: any[]; 
        model: string; 
        provider?: string; 
        temperature?: number;
        semantic?: boolean; 
        previous_query?: string 
    }): Promise<CacheCheckResult> {
        const key = SemanticCacheService.generateKey({
            provider: params.provider || 'openai',
            model: params.model,
            messages: params.messages,
            temperature: params.temperature
        });

        const latestQuery = params.messages[params.messages.length - 1]?.content || '';
        
        // Phase 3: Observe Transition for Predictive Prefetch
        if (latestQuery) {
            cognitiveMemory.observeTransition(params.previous_query, latestQuery).catch(err => 
                console.error("[Cognitive] Observe failed:", err)
            );
        }

        const cachedResponse = await redis.get(key);
        const ttl = (cachedResponse && typeof redis.ttl === 'function') ? await redis.ttl(key) : 0;
        
        // Get predictive prefetch regardless of hit/miss
        const predictivePrefetch = latestQuery
            ? await cognitiveMemory.predictNext(latestQuery, 1)
            : [];

        if (cachedResponse) {
            // Record a hit globally
            await redis.incr('stats:total_hits');
            await redis.incrbyfloat('stats:total_savings_usd', 0.05); // Standard $0.05 per hit
            await cognitiveMemory.recordCacheOutcome(true);

            return {
                cached: true,
                hit: true,
                response: String(cachedResponse),
                key: key.slice(-16), // Return partial key as per contract
                ttl,
                type: 'exact',
                similarity: 1.0,
                savedUsd: 0.05,
                coherence: 1.0,
                predictive_prefetch: predictivePrefetch
            };
        }

        await cognitiveMemory.recordCacheOutcome(false);
        return { 
            cached: false, 
            hit: false,
            key: key.slice(-16),
            predictive_prefetch: predictivePrefetch
        };
    }

    /**
     * Store a response in L2.
     */
    async set(params: { 
        messages: any[]; 
        model: string; 
        provider?: string; 
        temperature?: number;
        response: string; 
        ttl?: number 
    }): Promise<string> {
        const key = SemanticCacheService.generateKey({
            provider: params.provider || 'openai',
            model: params.model,
            messages: params.messages,
            temperature: params.temperature
        });
        
        const ttl = params.ttl || 604800;
        await redis.setex(key, ttl, params.response);
        return key;
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
