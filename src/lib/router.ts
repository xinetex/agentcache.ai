import { queryMemory, upsertMemory } from './vector.js';
import { createHash } from 'crypto';

export interface SemanticCacheResult {
    hit: boolean;
    response?: string;
    score?: number;
    metadata?: any;
}

export class SemanticRouter {
    private minScore: number;

    constructor(threshold: number = 0.90) {
        this.minScore = threshold;
    }

    /**
     * Find a semantically similar query in the cache
     */
    async find(query: string): Promise<SemanticCacheResult> {
        try {
            // Query the vector index
            const results = await queryMemory(query, 1);

            if (results.length > 0) {
                const match = results[0];

                // Check similarity score
                if (match.score >= this.minScore) {
                    return {
                        hit: true,
                        response: match.metadata?.response as string,
                        score: match.score,
                        metadata: match.metadata
                    };
                }
            }

            return { hit: false };
        } catch (error) {
            console.error('SemanticRouter find error:', error);
            return { hit: false };
        }
    }

    /**
     * Cache a query-response pair
     */
    async cache(query: string, response: string, metadata: any = {}): Promise<void> {
        try {
            // Use Deterministic ID (Content-Addressable)
            const id = createHash('sha256').update(query.trim()).digest('hex');

            await upsertMemory(id, query, {
                ...metadata,
                response, // Store the response in metadata
                query,    // Store original query for debugging
                cachedAt: Date.now()
            });
        } catch (error) {
            console.error('SemanticRouter cache error:', error);
        }
    }
}
