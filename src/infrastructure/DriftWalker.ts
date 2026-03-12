/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
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
    private cosineSimilarity(a: number[], b: number[]): number {
        // [STABILITY GUARD] - Ensure vectors are valid before accessing .length
        if (!a || !b) {
            console.warn('[DriftWalker] cosineSimilarity: Received undefined/null vector(s)');
            return 0;
        }
        
        if (a.length === 0 || b.length === 0) {
            console.warn('[DriftWalker] cosineSimilarity: Received empty vector(s)');
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
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
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

        if (!results || results.length === 0 || !results[0]) {
            console.warn(`[DriftWalker] Vector ID ${id} not found in index.`);
            return { drift: 1.0, status: 'dead' };
        }

        const stored = results[0];
        const originalText = (stored.metadata?.query || stored.data) as string;
        const storedMyVector = stored.vector;

        if (!originalText) {
            console.warn(`[DriftWalker] No text metadata for ${id}. Cannot verify drift.`);
            return { drift: 0, status: 'healthy' };
        }

        // 2. Generate Fresh Embedding (Current Truth)
        const freshVector = await generateEmbedding(originalText);

        // 3. Compare (Cosine Drift)
        // Hard check before calling cosineSimilarity
        if (!storedMyVector || !freshVector) {
            console.error(`[DriftWalker] Failed to get vectors for comparison. ID: ${id}`);
            return { drift: 1, status: 'dead', originalText };
        }

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
