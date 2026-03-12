/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */

import { Sector } from './ChaosRecoveryEngine.js';
import { observabilityService } from './ObservabilityService.js';

export interface AgentStats {
    totalTasks: number;
    cognitiveErrors: number;    // Semantically wrong but syntactically valid
    humanOverrides: number;     // Human had to correct output
    downstreamDamage: number;  // Caused other agents to fix errors
    chaosEpisodes: number;     // Number of provocations encountered
    chaosSuccesses: number;    // Successful recoveries
    recoveryTimeMs: number;    // Total time spent in recovery
    highStakesTasks: number;   // Sector-weighted tasks (e.g. Healthcare)
}

export interface ReputationState {
    reputation: number;         // 0.0 - 1.0
    status: 'healthy' | 'warn' | 'isolated';
    lastUpdated: number;
}

/**
 * ReputationService
 * 
 * Implements Phase 14 "Cognitive Reputation & Decay".
 * Tracks agentic performance metrics and applies mathematical decay to trust scores.
 * Uses the CER/OR/DDR framework from the user's "concrete metric-routing-decay" notes.
 */
export class ReputationService {
    private agentStats = new Map<string, AgentStats>();
    private reputationStates = new Map<string, ReputationState>();

    // Constants tuned for Phase 14 reactivity
    private readonly ETA = 0.2;           // Reactivity smoothing constant
    private readonly LAMBDA_T = 1.5;      // Time penalty sharpener (stricter)
    private readonly LAMBDA_D = 0.5;      // Drift decay factor
    private readonly MRT_TARGET = 800;   // Target recovery ms (stricter)
    private readonly REPN_WARN = 0.8;     // Warning threshold
    private readonly REPN_ISO = 0.5;      // Isolation threshold

    /**
     * Increment a specific stat for an agent.
     */
    trackStat(agentId: string, statKind: keyof AgentStats, amount: number = 1) {
        let stats = this.agentStats.get(agentId);
        if (!stats) {
            stats = this.getDefaultStats();
            this.agentStats.set(agentId, stats);
        }
        (stats[statKind] as number) += amount;
        
        // Asynchronously update reputation for this agent
        this.updateReputation(agentId).catch(console.error);
    }

    /**
     * Update the reputation of an agent based on their windowed stats.
     */
    private async updateReputation(agentId: string) {
        const stats = this.agentStats.get(agentId);
        if (!stats) return;

        const eps = 0.00001;
        const cer = stats.cognitiveErrors / (stats.totalTasks + eps);
        const or = stats.humanOverrides / (stats.totalTasks + eps);
        const ddr = stats.downstreamDamage / (stats.totalTasks + eps);

        // Cognitive Chaos Score (CCS)
        // Weights: e=0.3, o=0.5, d=0.2 (weighted heavily toward overrides/damage)
        const ccs = (0.3 * cer) + (0.5 * or) + (0.2 * ddr);

        // Recovery Efficiency (RE)
        const crs = stats.chaosSuccesses / (stats.chaosEpisodes + eps);
        const mrt = stats.recoveryTimeMs / (stats.chaosEpisodes + eps);
        const re = crs * Math.exp(-this.LAMBDA_T * (mrt / this.MRT_TARGET));

        // Cognitive Cost (CogCost)
        // Weighted for high-stakes impact
        const stakeWeight = stats.highStakesTasks / (stats.totalTasks + eps);
        const cogCost = (0.4 * ccs) + (0.3 * (1 - crs)) + (0.2 * (mrt / this.MRT_TARGET)) + (0.1 * stakeWeight);

        // Performance Index (Perf)
        const perf = Math.min(1, Math.max(0, 1 - cogCost));

        // Exponential Smoothing for Reputation (R_a)
        const oldState = this.reputationStates.get(agentId);
        const oldRep = oldState?.reputation ?? 1.0;
        let newRep = (1 - this.ETA) * oldRep + this.ETA * perf;

        // Apply Drift-Sensitive Decay (Phase 14)
        // Note: Drift should be passed in or tracked via ReputationService
        // For now, we allow external update via a dedicated method

        // Determine Status
        let status: 'healthy' | 'warn' | 'isolated' = 'healthy';
        if (newRep < this.REPN_ISO) status = 'isolated';
        else if (newRep < this.REPN_WARN) status = 'warn';

        const state: ReputationState = {
            reputation: newRep,
            status,
            lastUpdated: Date.now()
        };

        this.reputationStates.set(agentId, state);

        // Emit telemetry if status changed or reputation dipped significantly
        if (Math.abs(newRep - oldRep) > 0.05 || status !== this.reputationStates.get(agentId)?.status) {
            await observabilityService.track({
                type: 'REPUTATION_UPDATE' as any,
                description: `Agent ${agentId} reputation: ${newRep.toFixed(2)} (${status})`,
                metadata: {
                    agentId,
                    reputation: newRep,
                    status,
                    ccs,
                    cogCost
                }
            });
        }
    }

    /**
     * Apply an additional decay factor based on semantic drift.
     */
    async applyDriftDecay(agentId: string, drift: number) {
        const state = this.reputationStates.get(agentId);
        if (!state) return;

        const decayedRep = state.reputation * (1 - (this.LAMBDA_D * drift));
        
        // Determine status based on decayed reputation
        let status: 'healthy' | 'warn' | 'isolated' = 'healthy';
        if (decayedRep < this.REPN_ISO) status = 'isolated';
        else if (decayedRep < this.REPN_WARN) status = 'warn';

        this.reputationStates.set(agentId, {
            ...state,
            reputation: decayedRep,
            status,
            lastUpdated: Date.now()
        });
    }

    /**
     * Get behavioral stats for an agent.
     */
    getStats(agentId: string): AgentStats {
        return this.agentStats.get(agentId) ?? this.getDefaultStats();
    }

    getReputation(agentId: string): ReputationState {
        return this.reputationStates.get(agentId) ?? {
            reputation: 1.0,
            status: 'healthy',
            lastUpdated: Date.now()
        };
    }

    /**
     * Get the collective reputation/health of a whole sector.
     * Useful for detecting systemic drift in Phase 16.
     */
    getSectorReputation(sector: string): { average: number; agentCount: number; status: 'healthy' | 'degrading' | 'critical' } {
        const sectorPrefix = sector.toLowerCase();
        let total = 0;
        let count = 0;

        // Note: For this to work accurately, agents must be tagged with their sector.
        // For MVP: We assume agents used in verify_{sector}.ts contain the sector name.
        // In prod: We would maintain an agent-to-sector mapping.
        for (const [agentId, state] of this.reputationStates.entries()) {
            if (agentId.toLowerCase().includes(sectorPrefix)) {
                total += state.reputation;
                count++;
            }
        }

        const average = count > 0 ? total / count : 1.0;
        let status: 'healthy' | 'degrading' | 'critical' = 'healthy';
        if (average < 0.6) status = 'critical';
        else if (average < 0.8) status = 'degrading';

        return { average, agentCount: count, status };
    }

    private getDefaultStats(): AgentStats {
        return {
            totalTasks: 0,
            cognitiveErrors: 0,
            humanOverrides: 0,
            downstreamDamage: 0,
            chaosEpisodes: 0,
            chaosSuccesses: 0,
            recoveryTimeMs: 0,
            highStakesTasks: 0
        };
    }
}

export const reputationService = new ReputationService();
