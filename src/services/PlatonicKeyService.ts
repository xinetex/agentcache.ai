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
import { TurboQuantService } from './TurboQuantService.js';
import { generateEmbedding } from '../lib/llm/embeddings.js';

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
 * TurboQuantCompressor — 8x-10x compression (3-bit) 
 */
export const TurboQuantCompressor: VectorCompressor = {
    compress: (v) => TurboQuantService.compress(v),
    decompress: (v) => TurboQuantService.decompress(v),
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
    embedding?: string; // ACTQ compressed Base64
}

export class PlatonicKeyService {
    private compressor: VectorCompressor;

    constructor(compressor?: VectorCompressor) {
        this.compressor = compressor || TurboQuantCompressor;
    }
    /**
     * Generate a provider-agnostic key from messages alone.
     * Strips provider/model to create a "universal" lookup.
     */
    static generatePlatonicKey(messages: any[], temperature?: number, sector?: string): string {
        const data = {
            messages,
            temperature: temperature ?? 0.7,
        };
        const hash = stableHash(data);
        const sectorKey = sector?.trim().toLowerCase() || 'global';
        return `agentcache:platonic:${sectorKey}:${hash}`;
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
        sector?: string;
        embedding?: number[];
    }): Promise<string> {
        const key = PlatonicKeyService.generatePlatonicKey(params.messages, params.temperature, params.sector);
        const compressedResponse = typeof params.response === 'string' ? params.response : JSON.stringify(params.response);
        
        // Generate/Compress embedding for Semantic Platonic Hits
        let actqEmbedding: string | undefined;
        try {
            const rawVec = params.embedding || await generateEmbedding(params.messages[params.messages.length - 1]?.content || '');
            const compressed = TurboQuantService.compress(rawVec);
            actqEmbedding = TurboQuantService.toBase64(compressed);
        } catch (err) {
            console.warn('[Platonic] Failed to generate/compress embedding for shadow:', err);
        }

        const entry: PlatonicCacheEntry = {
            response: compressedResponse,
            originalProvider: params.provider,
            originalModel: params.model,
            cachedAt: new Date().toISOString(),
            ttl: params.ttl || 604800,
            embedding: actqEmbedding,
        };

        await redis.setex(key, entry.ttl, JSON.stringify(entry));
        return key;
    }

    /**
     * Look up a Platonic cache entry.
     * Returns null if no cross-provider match exists.
     */
    async lookupPlatonic(messages: any[], temperature?: number, sector?: string): Promise<PlatonicCacheEntry | null> {
        const key = PlatonicKeyService.generatePlatonicKey(messages, temperature, sector);
        const raw = await redis.get(key);
        if (!raw) return null;

        try {
            return typeof raw === 'string' ? JSON.parse(raw) : raw as PlatonicCacheEntry;
        } catch {
            return null;
        }
    }
    /**
     * Semantic lookup in a given sector.
     * Uses "Lidar" mode to find matches even if hash doesn't match.
     */
    async lookupSemanticPlatonic(query: string, sector: string = 'global', threshold: number = 0.95): Promise<PlatonicCacheEntry | null> {
        const sectorKey = `agentcache:platonic:${sector.toLowerCase()}:*`;
        const keys = await redis.keys(sectorKey);
        
        if (keys.length === 0) return null;

        // Take the latest 100 entries for Lidar "Hot-Set" performance
        const hotSet = keys.slice(-100);
        const queryVec = await generateEmbedding(query);
        const queryCompressed = TurboQuantService.compress(queryVec);

        for (const key of hotSet) {
            const raw = await redis.get(key);
            if (!raw) continue;
            const entry = JSON.parse(raw as string) as PlatonicCacheEntry;
            
            if (entry.embedding) {
                const docVec = TurboQuantService.fromBase64(entry.embedding);
                const sim = TurboQuantService.fastSimilarity(queryCompressed, docVec);
                
                if (sim >= threshold) {
                    console.log(`[Platonic] 🎯 LIDAR HIT: Found semantic match with similarity ${sim.toFixed(4)}`);
                    return entry;
                }
            }
        }
        
        return null;
    }
}

export const platonicKeyService = new PlatonicKeyService();
