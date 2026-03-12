/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */

import { redis } from '../lib/redis.js';
import { createHash } from 'crypto';
import { stableHash } from '../lib/stable-json.js';
import { cognitiveMemory } from './cognitive-memory.js';
import { observabilityService } from './ObservabilityService.js';
import { eventBus } from '../lib/event-bus.js';

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
    drift?: number;
    reason?: 'exact' | 'semantic' | 'drift_bypass' | 'miss';
    sessionId?: string;
    turnIndex?: number;
}

/**
 * SemanticCacheService: Hierarchical memory for LLM swarms.
 * L1 (Local SDK - Handled by client)
 * L2 (Distributed Redis - Handled here)
 * 
 * Re-aligned with Phase 3 Cognitive/Predictive logic to satisfy contract tests.
 */
export class SemanticCacheService {
    private static antibodySessions = new Set<string>();

    constructor() {
        // Subscribe to antibody pulses for dynamic hardening
        eventBus.subscribe((event) => {
            if (event.type === 'antibody_pulse' && event.payload?.sessionId) {
                console.log(`[SemanticCache] 🛡️ Antibody pulse received for session ${event.payload.sessionId}. Hardening defenses.`);
                SemanticCacheService.antibodySessions.add(event.payload.sessionId);
                
                // Expiry pulse after 10 minutes
                setTimeout(() => {
                    SemanticCacheService.antibodySessions.delete(event.payload.sessionId);
                }, 600000);
            }
        });
    }
    
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
        previous_query?: string;
        sessionId?: string;
        turnIndex?: number;
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

        // Phase 31.5: Drift Assessment (The "Rot" Detector)
        let drift = 0;
        let driftBypass = false;
        
        if (latestQuery) {
            const driftResult = await cognitiveMemory.assessDrift(key, false, params.sessionId);
            drift = driftResult.drift;
            
            // Phase 32: Dynamic Hardening (Antibody Response)
            const threshold = SemanticCacheService.antibodySessions.has(params.sessionId || '') ? 0.05 : 0.15;
            
            if (drift > threshold) {
                driftBypass = true;
                const reason = SemanticCacheService.antibodySessions.has(params.sessionId || '') ? 'ANTIBODY_HARDENING' : 'DRIFT';
                console.log(`[Cognitive] ⚠️ Cache ${reason} detected (${(drift * 100).toFixed(1)}%). Bypassing for safety.`);
            }
        }

        if (cachedResponse && !driftBypass) {
            // Record a hit globally
            await redis.incr('stats:total_hits');
            await redis.incrbyfloat('stats:total_savings_usd', 0.05); // Standard $0.05 per hit
            await cognitiveMemory.recordCacheOutcome(true);

            const result: CacheCheckResult = {
                cached: true,
                hit: true,
                response: String(cachedResponse),
                key: key.slice(-16), // Return partial key as per contract
                ttl,
                type: 'exact',
                similarity: 1.0,
                savedUsd: 0.05,
                coherence: 1.0 - drift,
                predictive_prefetch: predictivePrefetch,
                drift,
                reason: 'exact',
                sessionId: params.sessionId,
                turnIndex: params.turnIndex
            };

            // Emit Observation Trace
            await observabilityService.track({
                type: 'CACHE_OPERATION',
                description: `Cache HIT: turn ${params.turnIndex || 0} (Drift: ${(drift * 100).toFixed(1)}%)`,
                sector: 'global',
                metadata: {
                    sessionId: params.sessionId,
                    turnIndex: params.turnIndex,
                    drift,
                    hit: true,
                    key: result.key
                }
            });

            return result;
        }

        await cognitiveMemory.recordCacheOutcome(false);
        
        const missResult: CacheCheckResult = { 
            cached: false, 
            hit: false,
            key: key.slice(-16),
            predictive_prefetch: predictivePrefetch,
            drift,
            reason: driftBypass ? 'drift_bypass' : 'miss',
            sessionId: params.sessionId,
            turnIndex: params.turnIndex
        };

        // Emit Observation Trace
        await observabilityService.track({
            type: 'CACHE_OPERATION',
            description: `Cache MISS: ${driftBypass ? 'DRIFT BYPASS' : 'NOT FOUND'}`,
            sector: 'global',
            metadata: {
                sessionId: params.sessionId,
                turnIndex: params.turnIndex,
                drift,
                hit: false,
                reason: missResult.reason
            }
        });

        return missResult;
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
        ttl?: number;
        circleId?: string;
        originAgent?: string;
        sessionId?: string;
        turnIndex?: number;
    }): Promise<string> {
        const key = SemanticCacheService.generateKey({
            provider: params.provider || 'openai',
            model: params.model,
            messages: params.messages,
            temperature: params.temperature
        });
        
        const ttl = params.ttl || 604800;
        await redis.setex(key, ttl, params.response);

        // Track metadata for Semantic Resonance (Phase 5)
        if (params.circleId || params.originAgent) {
            const latestQuery = params.messages[params.messages.length - 1]?.content || '';
            const { upsertMemory } = await import('../lib/vector.js');
            await upsertMemory(key, latestQuery, {
                circleId: params.circleId,
                originAgent: params.originAgent,
                responsePreview: params.response.substring(0, 100)
            });
        }

        // Emit Observation Trace
        await observabilityService.track({
            type: 'CACHE_OPERATION',
            description: `Cache SET: turn ${params.turnIndex || 0}`,
            sector: 'global',
            metadata: {
                sessionId: params.sessionId,
                turnIndex: params.turnIndex,
                key: key.slice(-16)
            }
        });

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
