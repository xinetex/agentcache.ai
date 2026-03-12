/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */

import { observabilityService } from './ObservabilityService.js';
import { RecoveryPlan } from './ChaosRecoveryEngine.js';
import { reputationService } from './ReputationService.js';

export interface SLOMetrics {
    selfCorrectionLoopMs: number[]; // Time from error to recovery
    resonanceSuccessRate: number;
    governanceBypassRate: number; // Unexpected bypasses
    latencyP95: number;
    recoveryCostScore: number; // Cumulative "Cognitive Cost"
    recoveryModes: Record<string, number>; // Distribution of recovery modes
}

/**
 * SLOMonitor
 * 
 * A high-level monitoring service for Phase 13.
 * It translates raw telemetry events into operational SLOs (Service Level Objectives)
 * for the agent swarm, focusing on resilience and "recovery velocity."
 */
export class SLOMonitor {
    private metrics: SLOMetrics = {
        selfCorrectionLoopMs: [],
        resonanceSuccessRate: 1.0,
        governanceBypassRate: 0.0,
        latencyP95: 0,
        recoveryCostScore: 0,
        recoveryModes: {}
    };

    private pendingCorrections: Map<string, number> = new Map();

    /**
     * Start tracking a self-correction loop.
     */
    trackCorrectionStart(errorId: string): void {
        this.pendingCorrections.set(errorId, Date.now());
        reputationService.trackStat(errorId, 'chaosEpisodes');
    }

    /**
     * Mark a self-correction as successful.
     */
    async trackCorrectionSuccess(errorId: string): Promise<void> {
        const start = this.pendingCorrections.get(errorId);
        if (start) {
            const duration = Date.now() - start;
            this.metrics.selfCorrectionLoopMs.push(duration);
            this.pendingCorrections.delete(errorId);

            reputationService.trackStat(errorId, 'chaosSuccesses');
            reputationService.trackStat(errorId, 'recoveryTimeMs', duration);

            await observabilityService.track({
                type: 'SLO_METRIC' as any,
                description: `Self-Correction Completed: ${duration}ms`,
                metadata: {
                    metric: 'self_correction_duration',
                    value: duration,
                    errorId
                }
            });
        }
    }

    /**
     * Record a recovery plan and its associated cognitive cost.
     */
    async trackRecoveryPlan(plan: RecoveryPlan): Promise<void> {
        // 1. Update Mode Distribution
        this.metrics.recoveryModes[plan.mode] = (this.metrics.recoveryModes[plan.mode] || 0) + 1;

        // 2. Calculate Incremental Cost
        let incrementalCost = 0;
        switch (plan.mode) {
            case 'syntactic_repair': incrementalCost += 1; break;
            case 'semantic_reconstruction': incrementalCost += 5; break;
            case 'window_reconciliation': incrementalCost += 3; break;
            case 'discard_and_realign': incrementalCost += 1; break;
        }

        if (plan.requiresHumanReview) {
            incrementalCost += 20; // Human intervention is the highest cost
        }

        this.metrics.recoveryCostScore += incrementalCost;

        // 3. Telemetry
        await observabilityService.track({
            type: 'RECOVERY_PLAN' as any,
            description: `Recovery Plan Assigned: ${plan.mode} (Cost: ${incrementalCost})`,
            metadata: {
                mode: plan.mode,
                requiresHuman: plan.requiresHumanReview,
                cost: incrementalCost,
                totalCost: this.metrics.recoveryCostScore
            }
        });
    }

    /**
     * Record a resonance attempt.
     */
    async trackResonance(success: boolean): Promise<void> {
        // Simple moving average for alpha = 0.1
        const alpha = 0.1;
        this.metrics.resonanceSuccessRate = (alpha * (success ? 1 : 0)) + ((1 - alpha) * this.metrics.resonanceSuccessRate);
        
        if (!success) {
            await observabilityService.track({
                type: 'SLO_VIOLATION' as any,
                description: `Resonance SLO Dip: ${this.metrics.resonanceSuccessRate.toFixed(2)}`,
                metadata: { metric: 'resonance_success_rate', value: this.metrics.resonanceSuccessRate }
            });
        }
    }

    /**
     * Get current SLO snapshot.
     */
    getSnapshot(): SLOMetrics {
        return {
            ...this.metrics,
            latencyP95: this.calculateP95(this.metrics.selfCorrectionLoopMs),
            recoveryModes: { ...this.metrics.recoveryModes } // Shallow copy
        };
    }

    private calculateP95(data: number[]): number {
        if (data.length === 0) return 0;
        const sorted = [...data].sort((a, b) => a - b);
        const index = Math.floor(sorted.length * 0.95);
        return sorted[index];
    }
}

export const sloMonitor = new SLOMonitor();
