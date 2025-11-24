import { vectorIndex } from './vector.js';

export interface SemanticCacheResult {
    hit: boolean;
    response?: string;
    score?: number;
    metadata?: any;
}

export class SemanticRouter {
    private index = vectorIndex;
    private minScore: number;

    constructor(threshold: number = 0.90) {
        this.minScore = threshold;
    }

    /**
     * Find a semantically similar query in the cache
     */
    async find(query: string): Promise<SemanticCacheResult> {
        if (!this.index) {
            console.warn('SemanticRouter: Vector index not configured');
            return { hit: false };
        }

        try {
            // Query the vector index
            // We assume the index is configured with an embedding model (e.g. BGE-M3)
            // so we can pass the raw text query directly.
            const results = await this.index.query({
                data: query,
                topK: 1,
                includeMetadata: true,
            });

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
        if (!this.index) return;

        try {
            // Use a deterministic ID based on the query to avoid duplicates?
            // Or just a random UUID? For semantic cache, we might want to overwrite exact matches,
            // but "fuzzy" matches are distinct entries.
            // Let's use a random ID for now, relying on the vector search to find the closest.
            // In a production system, we might want to prune nearby vectors to keep the index clean.

            const id = crypto.randomUUID();

            await this.index.upsert({
                id,
                data: query, // The vector is generated from the query
                metadata: {
                    ...metadata,
                    response, // Store the response in metadata
                    query,    // Store original query for debugging
                    cachedAt: Date.now()
                }
            });
        } catch (error) {
            console.error('SemanticRouter cache error:', error);
        }
    }
}
