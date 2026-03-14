/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL:
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file,
 * via any medium, is strictly prohibited.
 */

import { listFabricSkus } from '../config/fabricSkus.js';
import { redis } from '../lib/redis.js';
import type { MemoryFabricPolicy } from './MemoryFabricPolicyService.js';

type FabricMetricOperation = 'read' | 'write' | 'browser_proof';

type RecordFabricMetricInput = {
    policy: MemoryFabricPolicy;
    operation: FabricMetricOperation;
    hit?: boolean;
    promptText?: string;
    responseText?: string;
};

type FabricMetricsAggregate = {
    totalOperations: number;
    reads: number;
    writes: number;
    browserProofs: number;
    hits: number;
    misses: number;
    hitRate: number;
    estimatedTokensSaved: number;
    estimatedUsdSaved: number;
    estimatedLatencySavedMs: number;
    averageUsdSavedPerHit: number;
    ttlClampCount: number;
    evidenceTaggedOperations: number;
    evidenceCoverageRate: number;
};

export interface MemoryFabricAnalyticsSnapshot {
    asOf: string;
    summary: FabricMetricsAggregate;
    bySku: Array<FabricMetricsAggregate & { sku: string }>;
    bySector: Array<FabricMetricsAggregate & { sectorId: string }>;
}

const RETENTION_SECONDS = 90 * 24 * 60 * 60;
const USD_MICROS = 1_000_000;

function todayKey(date = new Date()): string {
    return date.toISOString().slice(0, 10);
}

function toMicros(amountUsd: number): number {
    return Math.round(amountUsd * USD_MICROS);
}

function fromMicros(micros: number): number {
    return Number((micros / USD_MICROS).toFixed(6));
}

function estimateTokenCount(...parts: Array<string | undefined>): number {
    const totalChars = parts
        .filter((part): part is string => typeof part === 'string' && part.length > 0)
        .reduce((sum, part) => sum + part.length, 0);
    return Math.max(0, Math.ceil(totalChars / 4));
}

function estimateUsdSaved(policy: MemoryFabricPolicy, tokenCount: number): number {
    const workloadMultiplier =
        policy.workloadProfile === 'copilot'
            ? 0.000006
            : policy.workloadProfile === 'transactional'
                ? 0.000009
                : 0.000008;
    const evidencePremium =
        policy.evidenceMode === 'audit'
            ? 0.0015
            : policy.evidenceMode === 'clinical'
                ? 0.002
                : 0.0005;
    return Math.max(evidencePremium, tokenCount * workloadMultiplier);
}

function estimateLatencySavedMs(policy: MemoryFabricPolicy): number {
    if (policy.workloadProfile === 'transactional') return 2200;
    if (policy.workloadProfile === 'clinical') return 1800;
    return 1400;
}

function emptyAggregate(): FabricMetricsAggregate {
    return {
        totalOperations: 0,
        reads: 0,
        writes: 0,
        browserProofs: 0,
        hits: 0,
        misses: 0,
        hitRate: 0,
        estimatedTokensSaved: 0,
        estimatedUsdSaved: 0,
        estimatedLatencySavedMs: 0,
        averageUsdSavedPerHit: 0,
        ttlClampCount: 0,
        evidenceTaggedOperations: 0,
        evidenceCoverageRate: 0,
    };
}

function parseHashMetrics(raw: Record<string, unknown>): FabricMetricsAggregate {
    const totalOperations = Number(raw.totalOperations || 0);
    const hits = Number(raw.hits || 0);
    const evidenceTaggedOperations = Number(raw.evidenceTaggedOperations || 0);

    return {
        totalOperations,
        reads: Number(raw.reads || 0),
        writes: Number(raw.writes || 0),
        browserProofs: Number(raw.browserProofs || 0),
        hits,
        misses: Number(raw.misses || 0),
        hitRate: totalOperations > 0 ? Number((hits / Math.max(1, Number(raw.reads || 0)) * 100).toFixed(1)) : 0,
        estimatedTokensSaved: Number(raw.estimatedTokensSaved || 0),
        estimatedUsdSaved: fromMicros(Number(raw.estimatedUsdSavedMicros || 0)),
        estimatedLatencySavedMs: Number(raw.estimatedLatencySavedMs || 0),
        averageUsdSavedPerHit: hits > 0 ? fromMicros(Math.round(Number(raw.estimatedUsdSavedMicros || 0) / hits)) : 0,
        ttlClampCount: Number(raw.ttlClampCount || 0),
        evidenceTaggedOperations,
        evidenceCoverageRate: totalOperations > 0 ? Number((evidenceTaggedOperations / totalOperations * 100).toFixed(1)) : 0,
    };
}

export class MemoryFabricAnalyticsService {
    private keyFor(date: string, scope: 'global' | 'sku' | 'sector', value?: string): string {
        if (scope === 'global') return `fabric:analytics:${date}:global`;
        if (!value) throw new Error('Analytics scope requires a value.');
        return `fabric:analytics:${date}:${scope}:${value}`;
    }

    private async incrementHash(key: string, field: string, value: number): Promise<void> {
        if (!value) return;
        await redis.hincrby(key, field, value);
    }

    private async touchKey(key: string): Promise<void> {
        await redis.expire(key, RETENTION_SECONDS);
    }

    async recordOperation(input: RecordFabricMetricInput): Promise<void> {
        const date = todayKey();
        const globalKey = this.keyFor(date, 'global');
        const skuKey = this.keyFor(date, 'sku', input.policy.verticalSku);
        const sectorKey = this.keyFor(date, 'sector', input.policy.sectorId);
        const tokenEstimate = input.hit
            ? estimateTokenCount(input.promptText, input.responseText)
            : 0;
        const usdSavedMicros = input.hit
            ? toMicros(estimateUsdSaved(input.policy, tokenEstimate))
            : 0;
        const latencySavedMs = input.hit ? estimateLatencySavedMs(input.policy) : 0;
        const evidenceTagged = input.policy.evidenceMode !== 'standard' ? 1 : 0;

        const targets = [globalKey, skuKey, sectorKey];

        await Promise.all([
            redis.sadd(`fabric:analytics:${date}:skus`, input.policy.verticalSku),
            redis.sadd(`fabric:analytics:${date}:sectors`, input.policy.sectorId),
            ...targets.flatMap((key) => {
                const ops: Promise<unknown>[] = [
                    this.incrementHash(key, 'totalOperations', 1),
                    this.incrementHash(key, 'evidenceTaggedOperations', evidenceTagged),
                    this.incrementHash(key, 'ttlClampCount', input.policy.ttlClamped ? 1 : 0),
                    this.incrementHash(key, 'estimatedTokensSaved', tokenEstimate),
                    this.incrementHash(key, 'estimatedUsdSavedMicros', usdSavedMicros),
                    this.incrementHash(key, 'estimatedLatencySavedMs', latencySavedMs),
                    this.touchKey(key),
                ];

                if (input.operation === 'read') {
                    ops.push(this.incrementHash(key, 'reads', 1));
                    ops.push(this.incrementHash(key, input.hit ? 'hits' : 'misses', 1));
                } else if (input.operation === 'write') {
                    ops.push(this.incrementHash(key, 'writes', 1));
                } else if (input.operation === 'browser_proof') {
                    ops.push(this.incrementHash(key, 'browserProofs', 1));
                }

                return ops;
            }),
        ]);
    }

    async getSnapshot(filters?: { sku?: string | null; sectorId?: string | null; date?: string | null }): Promise<MemoryFabricAnalyticsSnapshot> {
        const date = filters?.date || todayKey();
        const skuFilter = filters?.sku?.trim() || null;
        const sectorFilter = filters?.sectorId?.trim() || null;

        const summary = parseHashMetrics(await redis.hgetall(this.keyFor(date, 'global')));

        const skuIds = skuFilter
            ? [skuFilter]
            : Array.from(new Set(listFabricSkus().map((sku) => sku.id)));
        const sectorIds = sectorFilter
            ? [sectorFilter]
            : (await redis.smembers(`fabric:analytics:${date}:sectors`)).map(String).sort();

        const bySku = (await Promise.all(
            skuIds.map(async (sku) => ({
                sku,
                ...parseHashMetrics(await redis.hgetall(this.keyFor(date, 'sku', sku))),
            }))
        )).filter((item) => item.totalOperations > 0 || skuFilter);

        const bySector = (await Promise.all(
            sectorIds.map(async (sectorId) => ({
                sectorId,
                ...parseHashMetrics(await redis.hgetall(this.keyFor(date, 'sector', sectorId))),
            }))
        )).filter((item) => item.totalOperations > 0 || sectorFilter);

        return {
            asOf: new Date().toISOString(),
            summary,
            bySku,
            bySector,
        };
    }
}

export const memoryFabricAnalyticsService = new MemoryFabricAnalyticsService();
