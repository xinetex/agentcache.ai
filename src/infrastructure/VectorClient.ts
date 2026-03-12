import { EmbeddingProvider } from '../lib/llm/types.js';
import { LocalEmbeddingProvider } from '../lib/llm/providers/local-embeddings.js';
import { provocationEngine } from '../services/ProvocationEngine.js';
import { Index } from '@upstash/vector';

/**
 * Shard Interface: Represents a single unit of vector storage for mock mode.
 */
interface Shard {
    id: string;
    vectors: Map<number, number[]>;
    metadata: Map<number, any>;
}

/**
 * VectorClient: Cognitive Vector Service (CVS) Client - Phase 20.
 * 
 * Supports high-performance FAISS (C#) with Multi-Tenancy and 
 * Hybrid Cloud Fallback to Upstash Vector.
 */
export class VectorClient {
    private baseUrl: string;
    private embeddingProvider: EmbeddingProvider;
    private upstashIndex: Index | null = null;
    
    // Internal Mocks (for dev isolation)
    private shards: Map<string, Shard> = new Map();
    private activeShardId: string = 'shard-0';

    constructor(baseUrl: string = process.env.VECTOR_SERVICE_URL || 'http://localhost:5000/Vectors') {
        this.baseUrl = baseUrl;
        this.embeddingProvider = new LocalEmbeddingProvider();

        const isTest = process.env.NODE_ENV === 'test';
        const isMockForce = process.env.VECTOR_SERVICE_URL === 'mock' || baseUrl === 'mock';

        // Hybrid Fallback: Only trigger if not forced to mock and not in a test environment
        if (!isTest && !isMockForce && (!process.env.VECTOR_SERVICE_URL || process.env.VECTOR_SERVICE_URL === 'mock')) {
            const url = process.env.UPSTASH_VECTOR_REST_URL;
            const token = process.env.UPSTASH_VECTOR_REST_TOKEN;

            if (url && token) {
                console.log('☁️ Using Upstash Vector as Cloud Fallback Layer.');
                this.upstashIndex = new Index({ url, token });
                this.baseUrl = 'cloud';
            }
        }

        // Final safety: if no cloud and no real service, use mock
        if (this.baseUrl === 'mock' || (!this.upstashIndex && (!process.env.VECTOR_SERVICE_URL || process.env.VECTOR_SERVICE_URL === 'mock'))) {
            if (!this.upstashIndex) {
                console.warn('⚠️ No Vector Credentials. Using In-Memory Elastic Sharded Mock.');
                this.baseUrl = 'mock';
                this.createShard(this.activeShardId);
            }
        }
    }

    private createShard(id: string) {
        this.shards.set(id, { id, vectors: new Map(), metadata: new Map() });
    }

    private getHeaders(tenantId: string) {
        return {
            'Content-Type': 'application/json',
            'X-Tenant-Id': tenantId || 'default'
        };
    }

    async embed(text: string): Promise<number[]> {
        return this.embeddingProvider.embed(text);
    }

    async addVectors(ids: number[], vectors: number[], metadata?: any, tenantId: string = 'default'): Promise<void> {
        if (this.baseUrl === 'mock') {
            const shard = this.shards.get(this.activeShardId)!;
            if (shard.vectors.size >= 1000) {
                this.activeShardId = `shard-${this.shards.size}`;
                this.createShard(this.activeShardId);
            }
            const targetShard = this.shards.get(this.activeShardId)!;
            targetShard.vectors.set(ids[0], vectors);
            targetShard.metadata.set(ids[0], { ...metadata, _tenantId: tenantId });
            return;
        }

        if (this.upstashIndex) {
            try {
                await this.upstashIndex.upsert({ id: String(ids[0]), vector: vectors, metadata });
            } catch (e: any) {
                console.error('❌ Upstash Upsert Failed:', e.message);
            }
            return;
        }

        try {
            const response = await fetch(`${this.baseUrl}/add`, {
                method: 'POST',
                headers: this.getHeaders(tenantId),
                body: JSON.stringify({ ids, vectors, metadata })
            });

            if (!response.ok) throw new Error(`CVS Add Error: ${response.statusText}`);
        } catch (e) {
            console.error('CVS Add Failed:', e);
        }
    }

    async search(vector: number[], k: number = 5, filter?: Record<string, any>, tenantId: string = 'default'): Promise<any[]> {
        await provocationEngine.applyLatency(200);

        if (this.baseUrl === 'mock') {
            const allResults: any[] = [];
            for (const shard of Array.from(this.shards.values())) {
                for (const [id, storedVec] of Array.from(shard.vectors.entries())) {
                    const metadata = shard.metadata.get(id);
                    // Mock tenant isolation check
                    if (metadata?._tenantId !== tenantId) continue;
                    
                    if (filter?.circleId && metadata?.circleId !== filter.circleId) continue;
                    
                    let dot = 0, magA = 0, magB = 0;
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

        if (this.upstashIndex) {
            try {
                const results = await this.upstashIndex.query({ 
                    vector, 
                    topK: k, 
                    includeMetadata: true, 
                    filter: filter?.circleId ? `circleId = '${filter.circleId}'` : undefined 
                });
                return results.map(r => ({ id: Number(r.id), distance: 1 - r.score, metadata: r.metadata }));
            } catch (e: any) {
                console.error('❌ Upstash Query Failed:', e.message);
                if (e.message.includes('Unexpected token')) {
                    console.error('⚠️ Upstash returned non-JSON response. Check credentials or network.');
                }
                return [];
            }
        }

        try {
            const response = await fetch(`${this.baseUrl}/search`, {
                method: 'POST',
                headers: this.getHeaders(tenantId),
                body: JSON.stringify({ vector, k, filter })
            });
            return response.ok ? await response.json() : [];
        } catch (e) {
            console.error('CVS Search Failed:', e);
            return [];
        }
    }

    /**
     * Phase 20: Server-side Drift Calculation.
     * Tells the agent how much the current query "drifts" from tenant-specific centroids.
     */
    async drift(vector: number[], tenantId: string = 'default'): Promise<number> {
        if (this.upstashIndex || this.baseUrl === 'mock') {
            // Manual calculation for fallback/mock
            const results = await this.search(vector, 1, undefined, tenantId);
            return results.length > 0 ? results[0].distance : 1.0;
        }

        try {
            const response = await fetch(`${this.baseUrl}/drift`, {
                method: 'POST',
                headers: this.getHeaders(tenantId),
                body: JSON.stringify({ vector })
            });
            const data = await response.json();
            return data.drift || 1.0;
        } catch (e) {
            return 1.0;
        }
    }

    async fetch(id: number, tenantId: string = 'default'): Promise<number[]> {
        if (this.baseUrl === 'mock') {
            for (const shard of Array.from(this.shards.values())) {
                const v = shard.vectors.get(id);
                if (v) return v;
            }
            return [];
        }

        if (this.upstashIndex) {
            const res = await this.upstashIndex.fetch([String(id)], { includeVectors: true });
            return res[0]?.vector || [];
        }

        try {
            const response = await fetch(`${this.baseUrl}/${id}`, { headers: this.getHeaders(tenantId) });
            const data = await response.json();
            return data.vector || []; 
        } catch (e) {
            return [];
        }
    }
}
