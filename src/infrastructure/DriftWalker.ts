/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Authorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
import { vectorIndex } from '../lib/vector.js';
import { generateEmbedding } from '../lib/llm/embeddings.js';

export class DriftWalker {
    private index = vectorIndex;

    // Thresholds
    private DRIFT_WARNING = 0.1;
    private DRIFT_CRITICAL = 0.25;

    /**
     * Compute Cosine Similarity
     */
    private cosineSimilarity(a: any, b: any): number {
        // [CORRECTNESS GUARD] - Absolute type safety
        if (!Array.isArray(a) || !Array.isArray(b)) {
            console.warn('[DriftWalker] cosineSimilarity: Inputs are not arrays', { typeA: typeof a, typeB: typeof b });
            return 0;
        }
        
        if (a.length === 0 || b.length === 0) {
            return 0;
        }

        if (a.length !== b.length) {
            console.warn(`[DriftWalker] Dimension mismatch: ${a.length} vs ${b.length}`);
            return 0;
        }

        let dot = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < a.length; i++) {
            dot += (a[i] || 0) * (b[i] || 0);
            normA += (a[i] || 0) * (a[i] || 0);
            normB += (b[i] || 0) * (b[i] || 0);
        }
        
        const denominator = Math.sqrt(normA) * Math.sqrt(normB);
        return denominator === 0 ? 0 : dot / denominator;
    }

    /**
     * Scan a specific vector ID for "Semantic Rot"
     */
    async checkDrift(id: string): Promise<{ drift: number, status: 'healthy' | 'decaying' | 'dead', originalText?: string }> {
        if (!this.index) throw new Error('Vector Index not configured');

        // 1. Fetch Stored Vector & Metadata
        const results = await this.index.fetch([id], { includeVectors: true, includeMetadata: true });

        if (!results || !Array.isArray(results) || results.length === 0 || !results[0]) {
            return { drift: 1.0, status: 'dead' };
        }

        const stored = results[0];
        const originalText = (stored.metadata?.query || stored.data) as string;
        const storedMyVector = stored.vector;

        if (!originalText) {
            return { drift: 0, status: 'healthy' };
        }

        // 2. Fresh Embedding
        const freshVector = await generateEmbedding(originalText);

        // 3. Compare
        const similarity = this.cosineSimilarity(storedMyVector, freshVector);
        const drift = 1 - similarity;

        let status: 'healthy' | 'decaying' | 'dead' = 'healthy';
        if (drift > this.DRIFT_CRITICAL) status = 'dead';
        else if (drift > this.DRIFT_WARNING) status = 'decaying';

        return { drift, status, originalText };
    }

    /**
     * Heal a drifted vector
     */
    async heal(id: string, freshVector?: number[]): Promise<boolean> {
        if (!this.index) return false;

        let vectorToSave = freshVector;
        let metadata = {};

        if (!vectorToSave) {
            const results = await this.index.fetch([id], { includeMetadata: true });
            if (!results?.[0]) return false;

            const text = (results[0].metadata?.query || results[0].data) as string;
            if (!text) return false;

            vectorToSave = await generateEmbedding(text);
            metadata = results[0].metadata || {};
        }

        if (!vectorToSave) return false;

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
