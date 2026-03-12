/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PathDistiller: Background logic to aggregate raw traces into Path Tokens.
 */

import { db } from '../db/client.js';
import { periscopeActions, periscopePathStats } from '../db/schema.js';
import { eq, sql, avg, count } from 'drizzle-orm';

export class PathDistiller {
    /**
     * Distill all unprocessed actions into the aggregate path_stats table.
     * In a production environment, this would be a scheduled worker task.
     */
    async distillAll(): Promise<void> {
        console.log("[PathDistiller] 🏺 Starting distillation of raw traces...");
        // 1. Fine Grouping: {actionType, toolName, provider}
        const fineGroups = await db.select({
            actionType: periscopeActions.actionType,
            toolName: periscopeActions.toolName,
            provider: periscopeActions.provider,
            avgLatency: avg(periscopeActions.latencyMs),
            avgCost: avg(periscopeActions.tokenCost),
            totalCount: count(),
            successCount: sql`count(*) filter (where ${periscopeActions.success} = true)`,
            hitCount: sql`count(*) filter (where ${periscopeActions.cacheStatus} = 'hit')`,
            p95Latency: sql`percentile_cont(0.95) within group (order by ${periscopeActions.latencyMs})`
        })
        .from(periscopeActions)
        .groupBy(periscopeActions.actionType, periscopeActions.toolName, periscopeActions.provider);

        for (const group of fineGroups) {
            const actionKey = `${group.actionType}:${group.toolName || 'none'}:${group.provider || 'none'}`;
            await this.upsertStats(actionKey, group);
        }

        // 2. Coarse Grouping (Wide Aperture): {actionType, toolName}
        const coarseGroups = await db.select({
            actionType: periscopeActions.actionType,
            toolName: periscopeActions.toolName,
            avgLatency: avg(periscopeActions.latencyMs),
            avgCost: avg(periscopeActions.tokenCost),
            totalCount: count(),
            successCount: sql`count(*) filter (where ${periscopeActions.success} = true)`,
            hitCount: sql`count(*) filter (where ${periscopeActions.cacheStatus} = 'hit')`,
            p95Latency: sql`percentile_cont(0.95) within group (order by ${periscopeActions.latencyMs})`
        })
        .from(periscopeActions)
        .groupBy(periscopeActions.actionType, periscopeActions.toolName);

        for (const group of coarseGroups) {
            const actionKey = `${group.actionType}:${group.toolName || 'none'}:global`;
            await this.upsertStats(actionKey, group);
        }

        console.log(`[PathDistiller] ✅ Distilled ${fineGroups.length} fine and ${coarseGroups.length} coarse patterns.`);
    }

    private async upsertStats(actionKey: string, group: any) {
        const successRate = group.totalCount ? Number(group.successCount) / Number(group.totalCount) : 1.0;
        const cacheHitRate = group.totalCount ? Number(group.hitCount) / Number(group.totalCount) : 0;

        await db.insert(periscopePathStats)
            .values({
                actionKey,
                avgLatencyMs: group.avgLatency ? Number(group.avgLatency) : 0,
                p95LatencyMs: group.p95Latency ? Number(group.p95Latency) : (group.avgLatency ? Number(group.avgLatency) * 1.5 : 0),
                avgTokenCost: group.avgCost ? Number(group.avgCost) : 0,
                successRate,
                cacheHitRate,
                sampleCount: Number(group.totalCount),
                updatedAt: new Date()
            })
            .onConflictDoUpdate({
                target: periscopePathStats.actionKey,
                set: {
                    avgLatencyMs: group.avgLatency ? Number(group.avgLatency) : 0,
                    p95LatencyMs: group.p95Latency ? Number(group.p95Latency) : (group.avgLatency ? Number(group.avgLatency) * 1.5 : 0),
                    avgTokenCost: group.avgCost ? Number(group.avgCost) : 0,
                    successRate,
                    cacheHitRate,
                    sampleCount: Number(group.totalCount),
                    updatedAt: new Date()
                }
            });
    }

    /**
     * Cleanup old traces to prevent data bloat.
     */
    async pruneOldTraces(daysRetention: number = 7): Promise<void> {
        const threshold = new Date();
        threshold.setDate(threshold.getDate() - daysRetention);

        const result = await db.delete(periscopeActions)
            .where(sql`${periscopeActions.createdAt} < ${threshold}`);
        
        console.log(`[PathDistiller] 🧹 Pruned old actions older than ${daysRetention} days.`);
    }
}

export const pathDistiller = new PathDistiller();
