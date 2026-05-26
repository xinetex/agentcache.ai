/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL:
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file,
 * via any medium, is strictly prohibited.
 */

import { applyAdapter, getAdapterStats } from './CayleyTransform.js';
import { redis } from '../redis.js';

/**
 * Trained adapter state for a single sector.
 */
export interface SectorAdapter {
    sectorId: string;
    blockSize: number;
    dimension: number;
    params: number[];        // Trained Cayley parameters
    version: string;         // Ontology version this was trained against
    trainedAt: string;       // ISO timestamp
    trainingExamples: number;
    perplexityBefore?: number;
    perplexityAfter?: number;
}

/**
 * Training example: an input/output pair from a successful ontology mapping.
 */
export interface MappingExample {
    sectorId: string;
    input: string;           // Normalized source data
    output: any;             // Successfully mapped + validated output
    confidence: 'high' | 'medium';
    capturedAt: string;
}

/**
 * SectorAdapterService: Manages per-sector Cayley unitary adapters.
 *
 * Lifecycle:
 * 1. COLLECT: Capture successful ontology mappings as training examples
 *    (happens automatically on every cache-miss that produces high-confidence output)
 * 2. TRAIN: When enough examples exist, train Cayley parameters offline
 *    (future: triggered by admin or cron when example count > threshold)
 * 3. INFER: Apply trained adapter to transform embeddings before LLM mapping
 *    (reduces perplexity → fewer errors → more cache hits)
 *
 * Current status: COLLECT phase is active. TRAIN and INFER are stubbed
 * and will be implemented when training data reaches critical mass.
 */
export class SectorAdapterService {
    private adapters: Map<string, SectorAdapter> = new Map();
    private static EXAMPLE_KEY_PREFIX = 'cayley:examples:';
    private static ADAPTER_KEY_PREFIX = 'cayley:adapter:';
    private static BLOCK_SIZE = 4; // 2-qubit equivalent — matches Multiverse paper

    /**
     * Record a successful ontology mapping as a training example.
     *
     * Called by OntologyService after a high/medium confidence mapping.
     * Examples accumulate in Redis until training threshold is reached.
     */
    async captureExample(example: MappingExample): Promise<void> {
        // Only capture high-confidence examples for training data quality
        if (example.confidence !== 'high') return;

        const key = `${SectorAdapterService.EXAMPLE_KEY_PREFIX}${example.sectorId}`;
        const serialized = JSON.stringify({
            input: example.input.substring(0, 2000), // Cap input size for storage
            output: example.output,
            capturedAt: example.capturedAt,
        });

        try {
            await redis.lpush(key, serialized);
            // Cap at 10,000 examples per sector (FIFO)
            await redis.ltrim(key, 0, 9999);
        } catch (e: any) {
            // Non-fatal — training data collection should never block the pipeline
            console.warn(`[CayleyAdapter] Failed to capture example for ${example.sectorId}: ${e.message}`);
        }
    }

    /**
     * Get the count of collected training examples for a sector.
     */
    async getExampleCount(sectorId: string): Promise<number> {
        try {
            const key = `${SectorAdapterService.EXAMPLE_KEY_PREFIX}${sectorId}`;
            return await redis.llen(key) as number;
        } catch {
            return 0;
        }
    }

    /**
     * Check if a sector has enough data to begin training.
     * Minimum: 500 high-confidence examples.
     */
    async isTrainingReady(sectorId: string): Promise<{ ready: boolean; count: number; threshold: number }> {
        const count = await this.getExampleCount(sectorId);
        const threshold = 500;
        return { ready: count >= threshold, count, threshold };
    }

    /**
     * Load a trained adapter from Redis (if one exists).
     */
    async loadAdapter(sectorId: string): Promise<SectorAdapter | null> {
        // Check in-memory cache first
        const cached = this.adapters.get(sectorId);
        if (cached) return cached;

        try {
            const key = `${SectorAdapterService.ADAPTER_KEY_PREFIX}${sectorId}`;
            const raw = await redis.get(key) as string | null;
            if (!raw) return null;

            const adapter: SectorAdapter = JSON.parse(raw);
            this.adapters.set(sectorId, adapter);
            return adapter;
        } catch {
            return null;
        }
    }

    /**
     * Save a trained adapter to Redis.
     */
    async saveAdapter(adapter: SectorAdapter): Promise<void> {
        const key = `${SectorAdapterService.ADAPTER_KEY_PREFIX}${adapter.sectorId}`;
        await redis.set(key, JSON.stringify(adapter));
        this.adapters.set(adapter.sectorId, adapter);
        console.log(`[CayleyAdapter] Saved adapter for ${adapter.sectorId}: ${adapter.params.length} params, trained on ${adapter.trainingExamples} examples`);
    }

    /**
     * Apply the trained adapter to transform an embedding vector.
     *
     * If no adapter exists for the sector, returns the input unchanged (passthrough).
     * This makes it safe to call unconditionally in the mapping pipeline.
     */
    async transform(sectorId: string, inputVector: number[]): Promise<number[]> {
        const adapter = await this.loadAdapter(sectorId);
        if (!adapter) return inputVector;

        // Ensure input dimension matches adapter
        if (inputVector.length !== adapter.dimension) {
            console.warn(`[CayleyAdapter] Dimension mismatch for ${sectorId}: input ${inputVector.length} vs adapter ${adapter.dimension}`);
            return inputVector;
        }

        return applyAdapter(inputVector, adapter.dimension, adapter.blockSize, adapter.params);
    }

    /**
     * Get status of all sector adapters.
     */
    async getStatus(): Promise<Array<{
        sectorId: string;
        exampleCount: number;
        trainingReady: boolean;
        hasAdapter: boolean;
        adapterStats: ReturnType<typeof getAdapterStats> | null;
    }>> {
        const sectors = ['finance', 'biotech', 'legal', 'robotics', 'healthcare', 'energy'];
        const results = [];

        for (const sectorId of sectors) {
            const { ready, count } = await this.isTrainingReady(sectorId);
            const adapter = await this.loadAdapter(sectorId);

            results.push({
                sectorId,
                exampleCount: count,
                trainingReady: ready,
                hasAdapter: !!adapter,
                adapterStats: adapter
                    ? getAdapterStats(adapter.dimension, adapter.blockSize)
                    : null,
            });
        }

        return results;
    }

    /**
     * Initialize a sector adapter with random parameters (for testing).
     * In production, parameters come from the training pipeline.
     */
    async initializeRandom(sectorId: string, dimension: number): Promise<SectorAdapter> {
        const blockSize = SectorAdapterService.BLOCK_SIZE;
        const stats = getAdapterStats(dimension, blockSize);

        // Small random initialization (near-identity behavior)
        const params = Array.from({ length: stats.totalParams }, () =>
            (Math.random() - 0.5) * 0.01
        );

        const adapter: SectorAdapter = {
            sectorId,
            blockSize,
            dimension,
            params,
            version: '1.1.0',
            trainedAt: new Date().toISOString(),
            trainingExamples: 0,
        };

        await this.saveAdapter(adapter);
        return adapter;
    }
}

export const sectorAdapterService = new SectorAdapterService();
