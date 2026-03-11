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
import { queryMemory } from '../lib/vector.js';
import { createHash } from 'crypto';

export interface ResonanceResult {
    id: string;
    text: string;
    normalizedScore: number; // 0.0 to 1.0 (Higher is stronger)
    rawMetric: number;      // Original distance from vector store
    metricType: 'L2' | 'Cosine';
    sourceLayer: string;    // e.g., 'vector', 'graph', 'semantic'
    originAgent: string;
    circleId: string;
}

/**
 * ResonanceService: The "Lateral Bridge" of the AgentCache Nervous System.
 * 
 * It allows agents within a "Nodal Circle" to resonant with each other's 
 * previous findings, enabling autonomous knowledge synthesis across disparate sessions.
 */
export class ResonanceService {

    private hashKey(apiKey: string): string {
        return createHash('sha256').update(apiKey).digest('hex').slice(0, 16);
    }

    /**
     * Join an agent (API Key) to a Nodal Circle
     */
    async joinCircle(apiKey: string, circleId: string): Promise<void> {
        const keyHash = this.hashKey(apiKey);
        await Promise.all([
            redis.sadd(`resonance:circle:${circleId}`, keyHash),
            redis.sadd(`user:circles:${keyHash}`, circleId)
        ]);
        console.log(`[Resonance] Agent ${keyHash} joined circle: ${circleId}`);
    }

    /**
     * Leave a Nodal Circle
     */
    async leaveCircle(apiKey: string, circleId: string): Promise<void> {
        const keyHash = this.hashKey(apiKey);
        await Promise.all([
            redis.srem(`resonance:circle:${circleId}`, keyHash),
            redis.srem(`user:circles:${keyHash}`, circleId)
        ]);
    }

    /**
     * Get all authorized circles for an agent
     */
    async getAgentCircles(apiKey: string): Promise<string[]> {
        const keyHash = this.hashKey(apiKey);
        const circles = await redis.smembers(`user:circles:${keyHash}`);
        return circles || [];
    }

    /**
     * Calculate Resonance: Search for knowledge lateral to the current query
     * within the authorized Nodal Circles.
     */
    async calculateResonance(query: string, apiKey: string, threshold: number = 0.88): Promise<ResonanceResult[]> {
        const circles = await this.getAgentCircles(apiKey);
        if (circles.length === 0) return [];

        // 1. Semantic Search with Metadata Scoping (Phase 7 Hardening)
        // We push the circleId constraint down to the vector store to avoid L2 noise.
        const results = await queryMemory(query, 10, { circleId: { $in: circles } });
        
        const resonanceResults: ResonanceResult[] = [];

        for (const res of results) {
            // Standard similarity conversion for normalized L2 distance (1 - distance)
            // Note: queryMemory currently returns distance in the 'score' field.
            const distance = res.score;
            const normalizedScore = Math.max(0, Math.min(1, 1 - distance)); 

            if (normalizedScore >= threshold) {
                resonanceResults.push({
                    id: res.id,
                    text: res.data,
                    normalizedScore,
                    rawMetric: distance,
                    metricType: 'L2',
                    sourceLayer: 'vector',
                    originAgent: res.metadata?.originAgent || 'unknown',
                    circleId: res.metadata?.circleId
                });
            }
        }

        return resonanceResults.sort((a, b) => b.normalizedScore - a.normalizedScore);
    }
}

export const resonanceService = new ResonanceService();
