/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */

import { stableHash } from '../lib/stable-json.js';
import { redis } from '../lib/redis.js';

/**
 * VectorCompressor interface — pluggable compression strategy.
 * Default: passthrough (full precision).
 * Future: TurboQuant (PolarQuant + QJL) when a JS library becomes available.
 */
export interface VectorCompressor {
    compress(vector: number[]): any;
    decompress(compressed: any): number[];
}

/** Default passthrough compressor — no compression, full precision */
export const PassthroughCompressor: VectorCompressor = {
    compress: (v) => v,
    decompress: (v) => v,
};

/**
 * PlatonicKeyService
 * 
 * Generates provider-agnostic "Platonic" cache keys.
 * While the standard cache key is scoped to `provider:model:hash`,
 * the Platonic key is scoped to `platonic:hash` — meaning the same
 * prompt cached from GPT-4 can satisfy a query intended for Claude-3.
 * 
 * This is the monetization layer of the Platonic Representation Hypothesis.
 */

export interface PlatonicCacheEntry {
    response: string;
    originalProvider: string;
    originalModel: string;
    cachedAt: string;
    ttl: number;
}

export class PlatonicKeyService {
    private compressor: VectorCompressor;

    constructor(compressor?: VectorCompressor) {
        this.compressor = compressor || PassthroughCompressor;
    }
    /**
     * Generate a provider-agnostic key from messages alone.
     * Strips provider/model to create a "universal" lookup.
     */
    static generatePlatonicKey(messages: any[], temperature?: number): string {
        const data = {
            messages,
            temperature: temperature ?? 0.7,
        };
        const hash = stableHash(data);
        return `agentcache:platonic:${hash}`;
    }

    /**
     * Store a Platonic shadow entry alongside the standard cache.
     */
    async storePlatonicShadow(params: {
        messages: any[];
        temperature?: number;
        response: string;
        provider: string;
        model: string;
        ttl?: number;
    }): Promise<string> {
        const key = PlatonicKeyService.generatePlatonicKey(params.messages, params.temperature);
        const entry: PlatonicCacheEntry = {
            response: params.response,
            originalProvider: params.provider,
            originalModel: params.model,
            cachedAt: new Date().toISOString(),
            ttl: params.ttl || 604800,
        };

        await redis.setex(key, entry.ttl, JSON.stringify(entry));
        return key;
    }

    /**
     * Look up a Platonic cache entry.
     * Returns null if no cross-provider match exists.
     */
    async lookupPlatonic(messages: any[], temperature?: number): Promise<PlatonicCacheEntry | null> {
        const key = PlatonicKeyService.generatePlatonicKey(messages, temperature);
        const raw = await redis.get(key);
        if (!raw) return null;

        try {
            return typeof raw === 'string' ? JSON.parse(raw) : raw as PlatonicCacheEntry;
        } catch {
            return null;
        }
    }
}

export const platonicKeyService = new PlatonicKeyService();
