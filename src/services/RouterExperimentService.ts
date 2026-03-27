/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */

/**
 * RouterExperimentService
 * 
 * Autoresearch-inspired self-optimization for the ModelRouter.
 * 
 * Pattern: modify → measure → keep/discard → repeat
 * 
 * Each heartbeat cycle:
 *   1. Evaluates the current experiment (if any) by comparing savings and cost
 *   2. If improved → promote override to production
 *   3. If degraded → revert to baseline
 *   4. Proposes a new experiment for the next cycle
 * 
 * Experiments are scoped. We never change more than one tier at a time.
 * All state is in Redis so it survives Vercel cold starts.
 */

import { redis } from '../lib/redis.js';
import { router } from '../lib/llm/router.js';

const EXPERIMENT_KEY = 'router:experiment:active';
const EXPERIMENT_HISTORY_KEY = 'router:experiment:history';
const BASELINE_METRICS_KEY = 'router:experiment:baseline';

export interface RouterExperiment {
    id: string;
    tier: string;
    originalProvider: string;
    originalModel: string;
    originalCost: number;
    candidateProvider: string;
    candidateModel: string;
    candidateCost: number;
    startedAt: string;
    status: 'active' | 'promoted' | 'reverted';
    baselineSavingsUsd?: number;
    baselineHitRate?: number;
    resultSavingsUsd?: number;
    resultHitRate?: number;
}

/** Candidate pool: alternative provider/model combos to experiment with */
const EXPERIMENT_CANDIDATES: { tier: string; provider: string; model: string; cost: number }[] = [
    // Try routing 'fast' tasks to MiniMax instead of GPT-5.4-mini
    { tier: 'fast', provider: 'minimax', model: 'MiniMax-M2.7', cost: 0.30 },
    // Try routing 'balanced' tasks to Grok instead of Claude
    { tier: 'balanced', provider: 'grok', model: 'grok-2', cost: 2.00 },
    // Try routing 'minimal' tasks to Moonshot
    { tier: 'minimal', provider: 'moonshot', model: 'kimi-latest', cost: 0.15 },
];

export class RouterExperimentService {

    /**
     * Run one optimization cycle.
     * Called by the Inngest heartbeat every 10 minutes.
     */
    async runCycle(): Promise<{ action: string; experiment?: RouterExperiment }> {
        // 1. Check if there's an active experiment
        const active = await this.getActiveExperiment();

        if (active) {
            // 2. Evaluate the active experiment
            return await this.evaluateExperiment(active);
        }

        // 3. No active experiment — propose a new one
        return await this.proposeExperiment();
    }

    /**
     * Evaluate a running experiment against baseline metrics.
     */
    private async evaluateExperiment(experiment: RouterExperiment): Promise<{ action: string; experiment: RouterExperiment }> {
        // Fetch current metrics
        const currentSavings = await this.getCurrentDailySavings();
        const currentHitRate = await this.getCurrentHitRate();

        experiment.resultSavingsUsd = currentSavings;
        experiment.resultHitRate = currentHitRate;

        const baselineSavings = experiment.baselineSavingsUsd || 0;
        const baselineHitRate = experiment.baselineHitRate || 0;

        // Decision: promote if savings increased OR hit rate improved without cost regression
        const savingsImproved = currentSavings >= baselineSavings * 0.95; // Allow 5% tolerance
        const hitRateImproved = currentHitRate >= baselineHitRate;

        if (savingsImproved && hitRateImproved) {
            // PROMOTE: keep the experiment as the new default
            experiment.status = 'promoted';
            await this.archiveExperiment(experiment);
            await redis.del(EXPERIMENT_KEY);

            // Update the router's static tier config to make this permanent
            router.setTierConfig(
                experiment.tier as any,
                experiment.candidateProvider,
                experiment.candidateModel,
                experiment.candidateCost
            );
            // Clear the experiment override
            router.setExperimentOverride(experiment.tier, null);

            console.log(`[RouterExperiment] ✅ PROMOTED: ${experiment.tier} → ${experiment.candidateProvider}/${experiment.candidateModel}`);
            return { action: 'promoted', experiment };
        } else {
            // REVERT: discard the experiment
            experiment.status = 'reverted';
            await this.archiveExperiment(experiment);
            await redis.del(EXPERIMENT_KEY);

            // Clear the experiment override — revert to baseline routing
            router.setExperimentOverride(experiment.tier, null);

            console.log(`[RouterExperiment] ❌ REVERTED: ${experiment.tier} experiment failed (savings: $${currentSavings.toFixed(2)} vs baseline $${baselineSavings.toFixed(2)})`);
            return { action: 'reverted', experiment };
        }
    }

    /**
     * Select and start a new experiment.
     */
    private async proposeExperiment(): Promise<{ action: string; experiment?: RouterExperiment }> {
        // Pick a random candidate from the pool
        const candidate = EXPERIMENT_CANDIDATES[Math.floor(Math.random() * EXPERIMENT_CANDIDATES.length)];

        // Snapshot baseline metrics before starting
        const baselineSavings = await this.getCurrentDailySavings();
        const baselineHitRate = await this.getCurrentHitRate();

        const experiment: RouterExperiment = {
            id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            tier: candidate.tier,
            originalProvider: '', // Will be populated from router
            originalModel: '',
            originalCost: 0,
            candidateProvider: candidate.provider,
            candidateModel: candidate.model,
            candidateCost: candidate.cost,
            startedAt: new Date().toISOString(),
            status: 'active',
            baselineSavingsUsd: baselineSavings,
            baselineHitRate: baselineHitRate,
        };

        await redis.set(EXPERIMENT_KEY, JSON.stringify(experiment), { ex: 1800 }); // 30-min TTL (auto-expire as safety)

        // Apply the experiment override to the live router
        router.setExperimentOverride(candidate.tier, {
            provider: candidate.provider,
            model: candidate.model,
            cost: candidate.cost,
        });

        // Store baseline for comparison
        await redis.set(BASELINE_METRICS_KEY, JSON.stringify({
            savings: baselineSavings,
            hitRate: baselineHitRate,
            timestamp: Date.now(),
        }), { ex: 1800 });

        console.log(`[RouterExperiment] 🧪 NEW EXPERIMENT: Try ${candidate.provider}/${candidate.model} for "${candidate.tier}" tier`);
        return { action: 'proposed', experiment };
    }

    /**
     * Get the active experiment (if any).
     */
    async getActiveExperiment(): Promise<RouterExperiment | null> {
        try {
            const raw = await redis.get(EXPERIMENT_KEY);
            if (!raw) return null;
            return typeof raw === 'string' ? JSON.parse(raw) : raw as RouterExperiment;
        } catch {
            return null;
        }
    }

    /**
     * Archive a completed experiment to history.
     */
    private async archiveExperiment(experiment: RouterExperiment): Promise<void> {
        await redis.lpush(EXPERIMENT_HISTORY_KEY, JSON.stringify(experiment));
        await redis.ltrim(EXPERIMENT_HISTORY_KEY, 0, 99); // Keep last 100
    }

    /**
     * Fetch current daily savings from Redis.
     */
    private async getCurrentDailySavings(): Promise<number> {
        try {
            const date = new Date().toISOString().slice(0, 10);
            const raw = await redis.get(`savings:global:${date}`);
            return parseFloat(String(raw ?? '0')) || 0;
        } catch {
            return 0;
        }
    }

    /**
     * Estimate current cache hit rate from Redis stats.
     */
    private async getCurrentHitRate(): Promise<number> {
        try {
            const [hitsRaw, totalRaw] = await Promise.all([
                redis.get('stats:total_hits'),
                redis.get('stats:total_requests'),
            ]);
            const hits = parseInt(String(hitsRaw ?? '0')) || 0;
            const total = parseInt(String(totalRaw ?? '0')) || 1;
            return hits / total;
        } catch {
            return 0;
        }
    }

    /**
     * Get experiment history for the dashboard.
     */
    async getHistory(limit: number = 20): Promise<RouterExperiment[]> {
        try {
            const raw = await redis.lrange(EXPERIMENT_HISTORY_KEY, 0, limit - 1);
            return raw.map(r => typeof r === 'string' ? JSON.parse(r) : r);
        } catch {
            return [];
        }
    }
}

export const routerExperimentService = new RouterExperimentService();
