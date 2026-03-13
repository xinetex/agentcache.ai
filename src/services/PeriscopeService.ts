/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PeriscopeService: Proactive advisory for agentic path optimization.
 * Phase 32.7: Predictive Pathing & ROI Routing.
 */

import { db } from '../db/client.js';
import { periscopeRuns, periscopeSteps, periscopeActions, periscopePathStats } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { redis } from '../lib/redis.js';
import * as crypto from 'crypto';

export interface ActionCandidate {
    id: string;
    actionType: string;
    toolName?: string;
    provider?: string;
    estimatedParams?: any;
}

export interface ObjectiveWeights {
    latency: number;
    token_cost: number;
    success_prob: number;
    cache_hit_prob: number;
}

export interface LensProfile {
    name: string;
    horizonSteps: number;
    useEmbeddings: boolean;
    vrActive: boolean; // Vibration Reduction (Stability Smoothing)
    edActive: boolean; // Extra-low Dispersion (Outlier Correction)
    weights: ObjectiveWeights;
}

export interface ScoringResult {
    candidates: any[];
    best_candidate_id: string;
    metadata: {
        profile: string;
        vrActive: boolean;
        edActive: boolean;
    };
}

export class PeriscopeService {
    public PROFILES: Record<string, LensProfile> = {
        wide: {
            name: 'wide',
            horizonSteps: 2,
            useEmbeddings: false,
            vrActive: false,
            edActive: false,
            weights: {
                latency: -1.5,
                token_cost: -0.5,
                success_prob: 1.0,
                cache_hit_prob: 0.5
            }
        },
        normal: {
            name: 'normal',
            horizonSteps: 3,
            useEmbeddings: true,
            vrActive: true,
            edActive: true,
            weights: {
                latency: -1.0,
                token_cost: -0.7,
                success_prob: 2.0,
                cache_hit_prob: 1.0
            }
        },
        tele: {
            name: 'tele',
            horizonSteps: 5,
            useEmbeddings: true,
            vrActive: true,
            edActive: true,
            weights: {
                latency: -0.7,
                token_cost: -0.5,
                success_prob: 3.0,
                cache_hit_prob: 1.5
            }
        }
    };

    private static DEFAULT_WEIGHTS: ObjectiveWeights = {
        latency: -1.0,
        token_cost: -0.7,
        success_prob: 2.0,
        cache_hit_prob: 1.0
    };

    /**
     * Score candidate next actions based on historical path statistics.
     */
    async scoreCandidates(
        candidates: ActionCandidate[], 
        options: { weights?: ObjectiveWeights, profile?: string } = {}
    ): Promise<ScoringResult> {
        let weights = options.weights || PeriscopeService.DEFAULT_WEIGHTS;
        let profile = options.profile || 'normal';
        let profileConfig = this.PROFILES[profile] || this.PROFILES.normal;

        if (options.profile && this.PROFILES[options.profile]) {
            weights = this.PROFILES[options.profile].weights;
        }

        const results = await Promise.all(candidates.map(async (candidate) => {
            const actionKey = this.generateActionKey(candidate);
            
            // 1. Try to get stats from path_stats table
            const statsArr = await db.select()
                .from(periscopePathStats)
                .where(eq(periscopePathStats.actionKey, actionKey))
                .limit(1);
            
            const stats = statsArr[0] || this.getDefaultStats();
            
            // 2. Optical Corrections:
            // ED (Extra-low Dispersion): Use p95 instead of average if active
            const latencyToUse = profileConfig.edActive ? stats.p95LatencyMs : stats.avgLatencyMs;
            
            // 3. Calculate score using the objective function:
            // score = w_L * (-latency) + w_T * (-token) + w_S * success_prob + w_C * cache_hit_prob
            let score = (weights.latency * latencyToUse) + 
                        (weights.token_cost * stats.avgTokenCost) + 
                        (weights.success_prob * stats.successRate) + 
                        (weights.cache_hit_prob * stats.cacheHitRate);
            
            // VR (Vibration Reduction): Stabilize score against sudden fluctuations
            // In v1, this mimics a stability cap or noise floor
            if (profileConfig.vrActive) {
                score = Math.round(score * 100) / 100; // Stabilize precision
            }

            return {
                id: candidate.id,
                predictions: {
                    expected_latency_ms: stats.avgLatencyMs,
                    latency_p95_ms: stats.p95LatencyMs,
                    expected_token_cost: stats.avgTokenCost,
                    success_prob: stats.successRate,
                    cache_hit_prob: stats.cacheHitRate
                },
                score,
                actionKey
            };
        }));

        // Sort by score descending
        const sorted = results.sort((a, b) => b.score - a.score);

        return {
            candidates: sorted,
            best_candidate_id: sorted[0]?.id,
            metadata: {
                profile: profileConfig.name,
                vrActive: profileConfig.vrActive,
                edActive: profileConfig.edActive
            }
        };
    }

    /**
     * Start a new agent run trace.
     */
    async startRun(agentId: string, sessionId: string): Promise<string> {
        const [run] = await db.insert(periscopeRuns)
            .values({
                agentId,
                sessionId,
            })
            .returning();
        
        return run.id;
    }

    /**
     * Log a new step within a run.
     */
    async logStep(runId: string, index: number, stateSignature?: any, goalTag?: string, signature?: string): Promise<string> {
        // Security: Verify trace signature (Phase 35)
        if (process.env.TRACE_SECRET && !this.verifySignature({ runId, index, goalTag }, signature)) {
            throw new Error('Invalid trace signature. Potential experience poisoning attempt blocked.');
        }

        const [step] = await db.insert(periscopeSteps)
            .values({
                runId,
                index,
                stateSignature,
                goalTag
            })
            .returning();
        
        return step.id;
    }

    /**
     * Log an action outcome.
     */
    async logAction(stepId: string, data: {
        actionType: string;
        toolName?: string;
        provider?: string;
        paramsHash?: string;
        cacheStatus?: string;
        latencyMs?: number;
        tokenCost?: number;
        success?: boolean;
        errorCode?: string;
    }, signature?: string): Promise<void> {
        // Security: Verify trace signature (Phase 35)
        if (process.env.TRACE_SECRET && !this.verifySignature({ stepId, actionType: data.actionType }, signature)) {
            throw new Error('Invalid action signature. Potential trace pollution blocked.');
        }

        await db.insert(periscopeActions)
            .values({
                stepId,
                ...data
            });
    }

    private verifySignature(payload: any, signature?: string): boolean {
        if (!process.env.TRACE_SECRET) return true; // Disabled
        if (!signature) return false;

        const expected = crypto.createHmac('sha256', process.env.TRACE_SECRET)
            .update(JSON.stringify(payload))
            .digest('hex');
        
        return signature === expected;
    }

    private generateActionKey(candidate: ActionCandidate): string {
        return `${candidate.actionType}:${candidate.toolName || 'none'}:${candidate.provider || 'none'}`;
    }

    private getDefaultStats() {
        return {
            avgLatencyMs: 500,
            p95LatencyMs: 1000,
            avgTokenCost: 1000,
            successRate: 0.9,
            cacheHitRate: 0.5
        };
    }
}

export const periscopeService = new PeriscopeService();
