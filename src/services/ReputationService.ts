/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * ReputationService: The Trust Fabric.
 * Manages agent reputation scores based on interaction history.
 */

import { db } from '../db/client.js';
import { maturityLedger } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { redis } from '../lib/redis.js';

export interface ReputationMarker {
    agentId: string;
    trustScore: number;
    reliability: number;
    level: number;
    reputation: number;
    status: 'trusted' | 'neutral' | 'suspicious';
}

export interface ReputationStats {
    totalTasks: number;
    cognitiveErrors: number;
    humanOverrides: number;
    chaosEpisodes: number;
    chaosSuccesses: number;
    recoveryTimeMs: number;
}

type SectorHealthStatus = 'healthy' | 'degrading' | 'critical';

const KNOWN_SECTORS = ['finance', 'biotech', 'legal', 'robotics', 'healthcare', 'energy'] as const;

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
}

function emptyStats(): ReputationStats {
    return {
        totalTasks: 0,
        cognitiveErrors: 0,
        humanOverrides: 0,
        chaosEpisodes: 0,
        chaosSuccesses: 0,
        recoveryTimeMs: 0,
    };
}

export class ReputationService {
    private statsCache = new Map<string, ReputationStats>();

    private mergeStats(agentId: string, partial: Partial<ReputationStats>): ReputationStats {
        const current = this.statsCache.get(agentId) || emptyStats();
        const next = {
            ...current,
            ...Object.fromEntries(
                Object.entries(partial).map(([key, value]) => [key, Number(value ?? current[key as keyof ReputationStats] ?? 0)])
            ),
        } as ReputationStats;
        this.statsCache.set(agentId, next);
        return next;
    }

    private inferSector(agentId: string): string | null {
        const normalized = agentId.toLowerCase();
        return KNOWN_SECTORS.find((sector) => normalized.includes(sector)) || null;
    }

    private computeStatsReputation(stats: ReputationStats): number {
        if (stats.totalTasks <= 0) {
            return 0.5;
        }

        const totalTasks = Math.max(1, stats.totalTasks);
        const errorRate = stats.cognitiveErrors / totalTasks;
        const overrideRate = stats.humanOverrides / totalTasks;
        const chaosRecoveryRate = stats.chaosEpisodes > 0
            ? stats.chaosSuccesses / Math.max(1, stats.chaosEpisodes)
            : 1;
        const recoveryPenalty = stats.chaosEpisodes > 0
            ? clamp01(stats.recoveryTimeMs / Math.max(1, stats.chaosEpisodes * 2000))
            : 0;

        const weightedCost =
            (0.45 * errorRate) +
            (0.25 * overrideRate) +
            (0.2 * (1 - chaosRecoveryRate)) +
            (0.1 * recoveryPenalty);

        return clamp01(1 - weightedCost);
    }

    private getStatus(score: number): ReputationMarker['status'] {
        return score > 0.8 ? 'trusted' : score > 0.5 ? 'neutral' : 'suspicious';
    }

    /**
     * Get the consolidated trust score for an agent.
     * Logic: (Maturity Level * 0.5) + (Success Rate * 0.5)
     */
    async getReputation(agentId: string): Promise<ReputationMarker> {
        const stats = await this.getStats(agentId);
        const statsReputation = this.computeStatsReputation(stats);

        // Fetch maturity ledger for this agent
        const maturity = await db.select()
            .from(maturityLedger)
            .where(eq(maturityLedger.agentId, agentId))
            .limit(1);

        if (maturity.length === 0) {
            const fallbackScore = stats.totalTasks > 0 ? statsReputation : 0.5;
            return {
                agentId,
                trustScore: fallbackScore,
                reliability: stats.totalTasks > 0 ? clamp01(1 - (stats.cognitiveErrors / Math.max(1, stats.totalTasks))) : 0,
                level: 1,
                reputation: fallbackScore,
                status: this.getStatus(fallbackScore)
            };
        }

        const m = maturity[0];
        const totalTasks = m.successCount + m.failureCount;
        const reliability = totalTasks > 0 ? m.successCount / totalTasks : 0;
        const maturityScore = (m.level / 3.0) * 0.6 + reliability * 0.4;
        const trustScore = clamp01((maturityScore * 0.7) + (statsReputation * 0.3));

        return {
            agentId,
            trustScore,
            reliability,
            level: m.level,
            reputation: trustScore,
            status: this.getStatus(trustScore)
        };
    }

    /**
     * Update reputation based on a recent interaction.
     */
    async recordInteraction(agentId: string, success: boolean, taskKey: string) {
        // 1. Update Maturity Ledger
        const existing = await db.select()
            .from(maturityLedger)
            .where(sql`${maturityLedger.agentId} = ${agentId} AND ${maturityLedger.taskKey} = ${taskKey}`)
            .limit(1);

        if (existing.length > 0) {
            await db.update(maturityLedger)
                .set({
                    successCount: success ? existing[0].successCount + 1 : existing[0].successCount,
                    failureCount: success ? existing[0].failureCount : existing[0].failureCount + 1,
                    lastSuccessAt: success ? new Date() : existing[0].lastSuccessAt,
                    updatedAt: new Date()
                })
                .where(eq(maturityLedger.id, existing[0].id));
        } else {
            await db.insert(maturityLedger).values({
                agentId,
                taskKey,
                successCount: success ? 1 : 0,
                failureCount: success ? 0 : 1,
                level: 1,
                lastSuccessAt: success ? new Date() : null
            });
        }

        // 2. Clear Redis cache for this reputation
        await redis.del(`reputation:${agentId}`);
    }

    /**
     * Get high-reputation agents for a specific task.
     */
    async getTopAgents(taskKey: string, minScore: number = 0.5) {
        return await db.select({
            agentId: maturityLedger.agentId,
            level: maturityLedger.level,
            success: maturityLedger.successCount
        })
        .from(maturityLedger)
        .where(sql`${maturityLedger.taskKey} = ${taskKey} AND ${maturityLedger.level} >= 1`)
        .orderBy(maturityLedger.level, maturityLedger.successCount)
        .limit(5);
    }

    async trackStat(agentId: string, stat: keyof ReputationStats | string, amount: number = 1): Promise<void> {
        const key = `reputation:stats:${agentId}`;
        const numericAmount = Number.isFinite(amount) ? amount : 1;
        this.mergeStats(agentId, {
            [stat]: ((this.statsCache.get(agentId) || emptyStats()) as any)[stat] + numericAmount
        } as Partial<ReputationStats>);

        if (Number.isInteger(numericAmount)) {
            await redis.hincrby(key, stat, numericAmount);
            return;
        }

        const current = Number(await redis.hget(key, stat) || 0);
        await redis.hset(key, stat, String(current + numericAmount));
    }

    async getStats(agentId: string): Promise<ReputationStats> {
        if (this.statsCache.has(agentId)) {
            return this.statsCache.get(agentId)!;
        }
        const raw = await redis.hgetall(`reputation:stats:${agentId}`);
        const stats = {
            totalTasks: Number(raw.totalTasks || 0),
            cognitiveErrors: Number(raw.cognitiveErrors || 0),
            humanOverrides: Number(raw.humanOverrides || 0),
            chaosEpisodes: Number(raw.chaosEpisodes || 0),
            chaosSuccesses: Number(raw.chaosSuccesses || 0),
            recoveryTimeMs: Number(raw.recoveryTimeMs || 0)
        };
        this.statsCache.set(agentId, stats);
        return stats;
    }

    async applyDriftDecay(agentId: string, driftScore: number): Promise<ReputationMarker> {
        if (driftScore > 0) {
            await this.trackStat(agentId, 'cognitiveErrors', Math.max(1, Math.round(driftScore * 10)));
        }
        return this.getReputation(agentId);
    }

    getSectorReputation(sector: string): { reputation: number; average: number; status: SectorHealthStatus; agentCount: number } {
        const normalizedSector = sector.toLowerCase();
        let total = 0;
        let agentCount = 0;

        for (const [agentId, stats] of this.statsCache.entries()) {
            if (this.inferSector(agentId) !== normalizedSector) continue;
            total += this.computeStatsReputation(stats);
            agentCount += 1;
        }

        if (agentCount === 0) {
            return {
                reputation: 0.7,
                average: 0.7,
                status: 'healthy',
                agentCount: 0,
            };
        }

        const average = clamp01(total / agentCount);
        const status: SectorHealthStatus =
            average < 0.45 ? 'critical' :
            average < 0.7 ? 'degrading' :
            'healthy';

        return {
            reputation: average,
            average,
            status,
            agentCount,
        };
    }
}

export const reputationService = new ReputationService();
