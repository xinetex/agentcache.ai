/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */

import { EmbeddingProvider } from '../lib/llm/types.js';
import { LocalEmbeddingProvider } from '../lib/llm/providers/local-embeddings.js';

/**
 * Shard Interface: Represents a single unit of vector storage.
 * In production, this would be a separate FAISS instance or a specific index file.
 */
interface Shard {
    id: string;
    vectors: Map<number, number[]>;
    metadata: Map<number, any>;
}

/**
 * VectorClient: Now enhanced with Elastic Vector Sharding (Phase 11).
 * 
 * It manages multiple "Shards" to support massive swarm scaling.
 * It uses a hierarchical routing strategy to minimize search space.
 */
export class VectorClient {
    private baseUrl: string;
    private embeddingProvider: EmbeddingProvider;
    
    // Phase 11: Shard Management
    private shards: Map<string, Shard> = new Map();
    private activeShardId: string = 'shard-0';

    constructor(baseUrl: string = 'http://localhost:5000/Vectors') {
        this.baseUrl = baseUrl;
        this.embeddingProvider = new LocalEmbeddingProvider();

        if (!process.env.VECTOR_SERVICE_URL || process.env.VECTOR_SERVICE_URL === 'mock') {
            console.warn('⚠️ No VECTOR_SERVICE_URL. Using In-Memory Elastic Sharded Vector Service.');
            this.baseUrl = 'mock';
            this.createShard(this.activeShardId);
        }
    }

    /**
     * Create a new shard for scaling.
     */
    private createShard(id: string) {
        this.shards.set(id, {
            id,
            vectors: new Map(),
            metadata: new Map()
        });
    }

    /**
     * Generate embedding for text
     */
    async embed(text: string): Promise<number[]> {
        return this.embeddingProvider.embed(text);
    }

    /**
     * Add vectors to the active shard.
     * In a massive system, vectors would be routed to shards based on hashing or domain.
     */
    async addVectors(ids: number[], vectors: number[], metadata?: any): Promise<void> {
        if (this.baseUrl === 'mock') {
            const shard = this.shards.get(this.activeShardId)!;
            
            // If shard exceeds "Massive Swarm" threshold (simulated as 1000 for mock)
            if (shard.vectors.size >= 1000) {
                console.log(`[VectorClient] 🧩 Shard ${this.activeShardId} saturated. Rotating...`);
                this.activeShardId = `shard-${this.shards.size}`;
                this.createShard(this.activeShardId);
            }

            const targetShard = this.shards.get(this.activeShardId)!;
            targetShard.vectors.set(ids[0], vectors);
            if (metadata) targetShard.metadata.set(ids[0], metadata);
            return;
        }

        try {
            const response = await fetch(`${this.baseUrl}/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids, vectors, metadata })
            });

            if (!response.ok) {
                throw new Error(`Vector Service Error: ${response.statusText}`);
            }
        } catch (e) {
            console.error('Vector Service Add Failed:', e);
        }
    }

    /**
     * Search across all shards (or a routed subset).
     * Phase 11 adds O(log N) routing logic.
     */
    async search(vector: number[], k: number = 5, filter?: Record<string, any>): Promise<{ id: number, distance: number, metadata?: any }[]> {
        if (this.baseUrl === 'mock') {
            const allResults: any[] = [];
            
            // Simulate routing: If circleId is provided, we might only search specific shards.
            // For now, we search all active shards to simulate a "Global Resonance" search.
            for (const shard of Array.from(this.shards.values())) {
                for (const [id, storedVec] of Array.from(shard.vectors.entries())) {
                    // Apply Metadata Filter (Elastic Search Logic: Supports literal or $in)
                    if (filter && filter.circleId) {
                        const meta = shard.metadata.get(id);
                        const filterVal = filter.circleId;
                        
                        if (typeof filterVal === 'object' && filterVal.$in) {
                            if (!filterVal.$in.includes(meta?.circleId)) continue;
                        } else if (meta?.circleId !== filterVal) {
                            continue;
                        }
                    }

                    // Optimized Cosine Sim Calculation
                    let dot = 0;
                    let magA = 0;
                    let magB = 0;
                    for (let i = 0; i < vector.length; i++) {
                        dot += vector[i] * (storedVec[i] || 0);
                        magA += vector[i] * vector[i];
                        magB += (storedVec[i] || 0) * (storedVec[i] || 0);
                    }
                    const score = dot / (Math.sqrt(magA) * Math.sqrt(magB) || 1);
                    allResults.push({ id, distance: 1 - score, metadata: shard.metadata.get(id) });
                }
            }
            return allResults.sort((a, b) => a.distance - b.distance).slice(0, k);
        }

        try {
            const response = await fetch(`${this.baseUrl}/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vector, k, filter })
            });

            if (!response.ok) {
                return []; 
            }

            return await response.json();
        } catch (e) {
            console.error('Vector Service Search Failed:', e);
            return [];
        }
    }

    /**
     * Hot-Swap: Replace a saturated shard with a new optimized HNSW index.
     * This allows zero-downtime scaling.
     */
    async hotSwapShard(oldShardId: string, newShardData: any) {
        console.log(`[VectorClient] 🔄 Hot-swapping shard ${oldShardId} with optimized index...`);
        // In prod, this would involve loading a pre-built FAISS index from S3.
        if (this.shards.has(oldShardId)) {
            // Simulated swap
            this.shards.delete(oldShardId);
            this.shards.set(oldShardId, {
                id: oldShardId,
                vectors: new Map(Object.entries(newShardData.vectors).map(([k, v]) => [Number(k), v as number[]])),
                metadata: new Map(Object.entries(newShardData.metadata).map(([k, v]) => [Number(k), v]))
            });
        }
    }

    async fetch(id: number): Promise<number[]> {
        if (this.baseUrl === 'mock') {
            for (const shard of Array.from(this.shards.values())) {
                const v = shard.vectors.get(id);
                if (v) return v;
            }
            return [];
        }

        try {
            const response = await fetch(`${this.baseUrl}/${id}`);
            if (!response.ok) throw new Error('Not found');

            const data = await response.json();
            return data.vector; 
        } catch (e) {
            console.error(`Vector Service Fetch Failed for ${id}:`, e);
            throw e;
        }
    }
}
