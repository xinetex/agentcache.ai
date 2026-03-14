/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL:
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file,
 * via any medium, is strictly prohibited.
 */

import { createHash } from 'crypto';
import { redis } from '../lib/redis.js';
import type { MemoryFabricPolicy } from './MemoryFabricPolicyService.js';

type BillingOperation = 'read' | 'write' | 'browser_proof';

type RecordBillingUsageInput = {
    apiKey?: string | null;
    accountId?: string | null;
    policy: MemoryFabricPolicy;
    operation: BillingOperation;
    hit?: boolean;
};

type BillingSummary = {
    totalCreditsEstimated: number;
    usdEquivalent: number;
    operations: number;
    reads: number;
    writes: number;
    browserProofs: number;
    bySku: Array<{
        sku: string;
        creditsEstimated: number;
        usdEquivalent: number;
        operations: number;
    }>;
};

const RETENTION_SECONDS = 90 * 24 * 60 * 60;
const CREDIT_MILLIS = 1000;

function todayKey(date = new Date()): string {
    return date.toISOString().slice(0, 10);
}

function toMilliCredits(credits: number): number {
    return Math.round(credits * CREDIT_MILLIS);
}

function fromMilliCredits(milliCredits: number): number {
    return Number((milliCredits / CREDIT_MILLIS).toFixed(3));
}

function creditsToUsd(credits: number): number {
    return Number((credits / 100).toFixed(2));
}

function hashAccount(apiKey?: string | null, accountId?: string | null): string | null {
    const source = (accountId || apiKey || '').trim();
    if (!source) return null;
    return createHash('sha256').update(source).digest('hex').slice(0, 16);
}

function parseBillingHash(raw: Record<string, unknown>) {
    const creditsEstimatedMilli = Number(raw.creditsEstimatedMilli || 0);
    return {
        totalCreditsEstimated: fromMilliCredits(creditsEstimatedMilli),
        usdEquivalent: creditsToUsd(fromMilliCredits(creditsEstimatedMilli)),
        operations: Number(raw.operations || 0),
        reads: Number(raw.reads || 0),
        writes: Number(raw.writes || 0),
        browserProofs: Number(raw.browserProofs || 0),
    };
}

export class MemoryFabricBillingService {
    private keyFor(date: string, scope: 'global' | 'account' | 'sku', value?: string, extra?: string): string {
        if (scope === 'global') return `fabric:billing:${date}:global`;
        if (!value) throw new Error('Billing scope requires a value.');
        if (scope === 'account' && extra) return `fabric:billing:${date}:account:${value}:sku:${extra}`;
        return `fabric:billing:${date}:${scope}:${value}`;
    }

    private estimateCredits(input: RecordBillingUsageInput): number {
        if (input.operation === 'browser_proof') {
            return input.policy.evidenceMode === 'clinical' ? 12 : input.policy.evidenceMode === 'audit' ? 9 : 6;
        }

        if (input.operation === 'write') {
            return input.policy.estimatedCredits.write + (input.policy.semanticReuse ? input.policy.estimatedCredits.semanticBonus : 0);
        }

        if (input.hit) {
            return input.policy.estimatedCredits.read;
        }

        return input.policy.estimatedCredits.read + input.policy.estimatedCredits.semanticBonus;
    }

    async recordUsage(input: RecordBillingUsageInput): Promise<{ creditsEstimated: number; usdEquivalent: number }> {
        const creditsEstimated = this.estimateCredits(input);
        const creditsEstimatedMilli = toMilliCredits(creditsEstimated);
        const date = todayKey();
        const accountHash = hashAccount(input.apiKey, input.accountId);
        const targets = [
            this.keyFor(date, 'global'),
            this.keyFor(date, 'sku', input.policy.verticalSku),
            ...(accountHash ? [this.keyFor(date, 'account', accountHash)] : []),
            ...(accountHash ? [this.keyFor(date, 'account', accountHash, input.policy.verticalSku)] : []),
        ];

        await Promise.all([
            redis.sadd(`fabric:billing:${date}:skus`, input.policy.verticalSku),
            ...(accountHash ? [redis.sadd(`fabric:billing:${date}:accounts`, accountHash)] : []),
            ...(accountHash ? [redis.sadd(`fabric:billing:${date}:account:${accountHash}:skus`, input.policy.verticalSku)] : []),
            ...targets.flatMap((key) => {
                const operations: Promise<unknown>[] = [
                    redis.hincrby(key, 'operations', 1),
                    redis.hincrby(key, 'creditsEstimatedMilli', creditsEstimatedMilli),
                    redis.expire(key, RETENTION_SECONDS),
                ];

                if (input.operation === 'read') {
                    operations.push(redis.hincrby(key, 'reads', 1));
                } else if (input.operation === 'write') {
                    operations.push(redis.hincrby(key, 'writes', 1));
                } else {
                    operations.push(redis.hincrby(key, 'browserProofs', 1));
                }

                return operations;
            }),
        ]);

        return {
            creditsEstimated,
            usdEquivalent: creditsToUsd(creditsEstimated),
        };
    }

    async getSummary(filters?: { accountId?: string | null; apiKey?: string | null; date?: string | null }): Promise<BillingSummary> {
        const date = filters?.date || todayKey();
        const accountHash = hashAccount(filters?.apiKey, filters?.accountId);
        const summaryRaw = await redis.hgetall(accountHash ? this.keyFor(date, 'account', accountHash) : this.keyFor(date, 'global'));
        const summary = parseBillingHash(summaryRaw);
        const skus = accountHash
            ? (await redis.smembers(`fabric:billing:${date}:account:${accountHash}:skus`)).map(String).sort()
            : (await redis.smembers(`fabric:billing:${date}:skus`)).map(String).sort();

        const bySku = (await Promise.all(
            skus.map(async (sku) => {
                const raw = await redis.hgetall(
                    accountHash ? this.keyFor(date, 'account', accountHash, sku) : this.keyFor(date, 'sku', sku)
                );
                const parsed = parseBillingHash(raw);
                return {
                    sku,
                    creditsEstimated: parsed.totalCreditsEstimated,
                    usdEquivalent: parsed.usdEquivalent,
                    operations: parsed.operations,
                };
            })
        )).filter((item) => item.operations > 0);

        return {
            ...summary,
            bySku,
        };
    }
}

export const memoryFabricBillingService = new MemoryFabricBillingService();
