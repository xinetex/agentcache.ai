import { vectorIndex } from '../lib/vector.js';
import { generateEmbedding } from '../lib/llm/embeddings.js';

export class DriftWalker {
    private index = vectorIndex;

    // Thresholds
    private DRIFT_WARNING = 0.1;
    private DRIFT_CRITICAL = 0.25; // 0.5 is usually completely unrelated

    /**
     * Compute Cosine Similarity
     */
    private cosineSimilarity(a: number[], b: number[]): number {
        let dot = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /**
     * Scan a specific vector ID for "Semantic Rot"
     */
    async checkDrift(id: string): Promise<{ drift: number, status: 'healthy' | 'decaying' | 'dead', originalText?: string }> {
        if (!this.index) throw new Error('Vector Index not configured');

        // 1. Fetch Stored Vector & Metadata
        // Upstash 'fetch' returns the vector and metadata
        const results = await this.index.fetch([id], { includeVectors: true, includeMetadata: true });

        if (!results || results.length === 0 || !results[0]) {
            throw new Error(`Vector ID ${id} not found`);
        }

        const stored = results[0];
        const originalText = stored.metadata?.query as string || stored.data as string; // 'data' field often used for text
        const storedMyVector = stored.vector;

        if (!originalText) {
            console.warn(`DriftWalker: No text metadata for ${id}. Cannot verify drift.`);
            return { drift: 0, status: 'healthy' }; // Cannot verify
        }

        // 2. Generate Fresh Embedding (Current Truth)
        // This uses the *currently configured* model/provider
        const freshVector = await generateEmbedding(originalText);

        // 3. Compare (Cosine Drift)
        const similarity = this.cosineSimilarity(storedMyVector, freshVector);
        const drift = 1 - similarity;

        let status: 'healthy' | 'decaying' | 'dead' = 'healthy';
        if (drift > this.DRIFT_CRITICAL) status = 'dead';
        else if (drift > this.DRIFT_WARNING) status = 'decaying';

        return { drift, status, originalText };
    }

    /**
     * Heal a drifted vector by overwriting it with the fresh one
     */
    async heal(id: string, freshVector?: number[]): Promise<boolean> {
        if (!this.index) return false;

        // Fetch to get metadata if we don't have fresh vector yet
        let vectorToSave = freshVector;
        let metadata = {};

        if (!vectorToSave) {
            const results = await this.index.fetch([id], { includeMetadata: true });
            if (!results?.[0]) return false;

            const text = results[0].metadata?.query as string || results[0].data as string;
            if (!text) return false;

            vectorToSave = await generateEmbedding(text);
            metadata = results[0].metadata || {};
        }

        if (!vectorToSave) return false;

        // Overwrite
        await this.index.upsert({
            id,
            vector: vectorToSave,
            metadata: {
                ...metadata,
                healedAt: Date.now(),
                driftCheck: 'healed'
            }
        });

        return true;
    }
}
