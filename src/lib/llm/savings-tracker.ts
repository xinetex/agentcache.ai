/**
 * SavingsTracker — The core metric for AgentCache.ai
 *
 * Tracks actual dollars saved per cache hit and model routing decision.
 * Persists to Redis so data survives Vercel cold starts.
 *
 * Keys:
 *   savings:global:YYYY-MM-DD     — total savings across all users today
 *   savings:user:<hash>:YYYY-MM-DD — per-user savings today
 *   savings:global:month:YYYY-MM  — monthly rollup
 *   savings:breakdown:YYYY-MM-DD  — JSON hash of savings by source type
 */

import { redis } from '../redis.js';
import { createHash } from 'crypto';

export interface SavingEvent {
    amountUsd: number;
    source: 'exact_cache' | 'semantic_cache' | 'model_routing' | 'tool_cache';
    model: string;
    timestamp: number;
}

class SavingsTracker {

    private hashKey(apiKey: string): string {
        return createHash('sha256').update(apiKey).digest('hex').slice(0, 16);
    }

    private today(): string {
        return new Date().toISOString().slice(0, 10);
    }

    private month(): string {
        return new Date().toISOString().slice(0, 7);
    }

    /**
     * Record a cost saving event
     */
    async recordSaving(apiKey: string, amountUsd: number, source: SavingEvent['source'], model: string): Promise<void> {
        if (amountUsd <= 0) return;

        const date = this.today();
        const monthKey = this.month();
        const userHash = this.hashKey(apiKey);

        try {
            // Atomic increments — all fire-and-forget for speed
            await Promise.all([
                // Global daily total
                redis.incrbyfloat(`savings:global:${date}`, amountUsd),
                redis.expire(`savings:global:${date}`, 90 * 86400), // 90 days

                // Per-user daily total
                redis.incrbyfloat(`savings:user:${userHash}:${date}`, amountUsd),
                redis.expire(`savings:user:${userHash}:${date}`, 90 * 86400),

                // Monthly rollup
                redis.incrbyfloat(`savings:global:month:${monthKey}`, amountUsd),

                // Increment source-specific counter
                redis.incrbyfloat(`savings:source:${source}:${date}`, amountUsd),
                redis.expire(`savings:source:${source}:${date}`, 90 * 86400),

                // Increment hit counter (for averages)
                redis.incrby(`savings:hits:${date}`, 1),
                redis.expire(`savings:hits:${date}`, 90 * 86400),
            ]);
        } catch (err) {
            console.warn('[SavingsTracker] Redis write failed:', err);
        }
    }

    /**
     * Get savings summary for today (or a specific date)
     */
    async getDailySavings(date?: string): Promise<{
        totalSavedUsd: number;
        cacheHits: number;
        avgSavingPerHit: number;
        breakdown: Record<string, number>;
    }> {
        const d = date || this.today();

        try {
            const [totalRaw, hitsRaw, exactRaw, semanticRaw, routingRaw, toolRaw] = await Promise.all([
                redis.get(`savings:global:${d}`),
                redis.get(`savings:hits:${d}`),
                redis.get(`savings:source:exact_cache:${d}`),
                redis.get(`savings:source:semantic_cache:${d}`),
                redis.get(`savings:source:model_routing:${d}`),
                redis.get(`savings:source:tool_cache:${d}`),
            ]);

            const totalSavedUsd = parseFloat(String(totalRaw ?? '0')) || 0;
            const cacheHits = parseInt(String(hitsRaw ?? '0')) || 0;

            return {
                totalSavedUsd,
                cacheHits,
                avgSavingPerHit: cacheHits > 0 ? totalSavedUsd / cacheHits : 0,
                breakdown: {
                    exact_cache: parseFloat(String(exactRaw ?? '0')) || 0,
                    semantic_cache: parseFloat(String(semanticRaw ?? '0')) || 0,
                    model_routing: parseFloat(String(routingRaw ?? '0')) || 0,
                    tool_cache: parseFloat(String(toolRaw ?? '0')) || 0,
                }
            };
        } catch (err) {
            console.warn('[SavingsTracker] Redis read failed:', err);
            return { totalSavedUsd: 0, cacheHits: 0, avgSavingPerHit: 0, breakdown: {} };
        }
    }

    /**
     * Get savings for a specific user
     */
    async getUserSavings(apiKey: string, date?: string): Promise<number> {
        const d = date || this.today();
        const userHash = this.hashKey(apiKey);
        try {
            const raw = await redis.get(`savings:user:${userHash}:${d}`);
            return parseFloat(String(raw ?? '0')) || 0;
        } catch {
            return 0;
        }
    }

    /**
     * Get monthly savings total
     */
    async getMonthlySavings(month?: string): Promise<number> {
        const m = month || this.month();
        try {
            const raw = await redis.get(`savings:global:month:${m}`);
            return parseFloat(String(raw ?? '0')) || 0;
        } catch {
            return 0;
        }
    }
}

export const savingsTracker = new SavingsTracker();
