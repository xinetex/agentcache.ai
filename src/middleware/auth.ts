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
import * as bcrypt from 'bcryptjs';
import { db } from '../db/client.js';
import { apiKeys, organizations } from '../db/schema.js';
import { redis } from '../lib/redis.js';
import { getTierQuota, getTierFeatures } from '../config/tiers.js';
import { eq } from 'drizzle-orm';
import { buildQuotaExceededPayload, getUpgradeDetails } from '../lib/upgrade-response.js';

// No hardcoded demo keys in production (Security Hardening Phase 35)

// Credits
const OVERAGE_CREDITS_PER_REQUEST = 1; // 1 credit = $0.01

// Middleware: Track usage in Redis with tier-based quotas
async function trackUsage(apiKey: string, tier: string = 'free') {
    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    const now = new Date();
    const monthKey = `usage:${keyHash}:m:${now.toISOString().slice(0, 7)}`;
    const quotaKey = `usage:${keyHash}:quota`;

    // Get tier-based quota
    const quota = getTierQuota(tier);

    // Update quota in Redis for caching
    await redis.set(quotaKey, quota.toString());
    await redis.set(`usage:${keyHash}:tier`, tier);

    // Increment usage
    const used = await redis.incr(monthKey);
    if (used === 1) {
        // First request this month - set 35 day expiry
        await redis.expire(monthKey, 3024000);
    }

    // Check quota (-1 = unlimited for enterprise)
    if (quota !== -1 && used > quota) {
        return { exceeded: true, used, quota, remaining: 0, keyHash };
    }

    return { exceeded: false, used, quota, remaining: quota === -1 ? -1 : quota - used, keyHash };
}

async function getCreditsBalance(keyHash: string): Promise<number> {
    try {
        const raw = await redis.get(`credits:${keyHash}`);
        const n = parseInt(String(raw ?? '0'), 10);
        return Number.isFinite(n) ? Math.max(0, n) : 0;
    } catch {
        return 0;
    }
}

async function tryConsumeCredits(keyHash: string, creditsToSpend: number): Promise<{ ok: boolean; balance: number }> {
    const key = `credits:${keyHash}`;

    // NOTE: We intentionally keep this compatible with MockRedis (no EVAL/DECRBY).
    const current = await getCreditsBalance(keyHash);

    if (current < creditsToSpend) {
        return { ok: false, balance: current };
    }

    const next = current - creditsToSpend;
    await redis.set(key, String(next));
    return { ok: true, balance: next };
}

// Middleware: API Key auth with tier enforcement and usage tracking
export async function authenticateApiKey(c: any) {
    const apiKey = c.req.header('X-API-Key') || c.req.header('Authorization')?.replace('Bearer ', '');
    const preauthorization = c.req.header('Preauthorization');

    // [x402 Agentic Payment Standard]
    // If Preauthorization exists (an agentic payment receipt via x402)
    if (preauthorization && preauthorization.startsWith('0x')) {
        const { agentSettlementService } = await import('../services/AgentSettlementService.js');
        const agentId = apiKey || 'x402-agent';

        // Settle a larger amount (10.0) to avoid any potential sub-cent rounding issues/misunderstandings in real-type
        const settlement = await agentSettlementService.settle(preauthorization, agentId, 10.0);

        if (settlement.success) {
            c.set('apiKey', agentId);
            c.set('tier', 'x402-paid');
            c.set('tierFeatures', getTierFeatures('enterprise'));
            c.set('usage', { used: 0, quota: -1, remaining: -1 });
            return null;
        } else {
            console.error(`[Auth] x402 Settlement Failed for ${agentId}: ${settlement.error}`);
            return c.json({
                error: `x402 Settlement Failed: ${settlement.error}`,
                details: settlement.error
            }, 402);
        }
    }

    if (!apiKey || !apiKey.startsWith('ac_')) {
        // Return error if no key, but allow next() if used as optional/middleware chain? 
        // Current usage returns response immediately (acting as a guard).
        return c.json({
            error: 'Invalid or missing API key',
            help: 'Get your API key at https://agentcache.ai/#signup'
        }, 401);
    }

    // Removal of hardcoded/demo auth path (Security Audit V1)

    // Fetch tier from Postgres with Redis caching
    try {
        const keyHash = createHash('sha256').update(apiKey).digest('hex');
        const cacheKey = `tier:${keyHash}`;

        let tier = 'free'; // default
        let tierFeatures = null;

        // Check Redis cache first (5 min TTL)
        const cachedTier = await redis.get(cacheKey);
        if (cachedTier) {
            tier = cachedTier as string;
            tierFeatures = getTierFeatures(tier);
        } else {
            // Query Postgres with Drizzle (Join api_keys -> organizations to get tier)
            const results = await db
                .select({
                    hash: apiKeys.hash,
                    tier: organizations.plan,
                    isActive: apiKeys.isActive
                })
                .from(apiKeys)
                .leftJoin(organizations, eq(apiKeys.orgId, organizations.id))
                .where(eq(apiKeys.isActive, true));

            for (const record of results) {
                if (!record.hash) continue; // Should not happen

                const match = await bcrypt.compare(apiKey, record.hash);
                if (match) {
                    tier = record.tier || 'free';
                    tierFeatures = getTierFeatures(tier);

                    // Cache tier in Redis for 5 minutes
                    await redis.setex(cacheKey, 300, tier);
                    break;
                }
            }
        }

        // Track usage with tier-based quota
        const usage = await trackUsage(apiKey, tier);

        // If quota exceeded, allow overage via credits
        if (usage.exceeded && OVERAGE_CREDITS_PER_REQUEST > 0) {
            const charge = await tryConsumeCredits(usage.keyHash, OVERAGE_CREDITS_PER_REQUEST);
            const upgrade = getUpgradeDetails(tier);

            if (!charge.ok) {
                // Attach x402 headers for agentic payment interceptors
                c.header('Pay-Uris', 'base:0xAgentCacheMasterWallet');
                c.header('Pay-Network', 'base-mainnet');
                c.header('Pay-Amount', '0.01'); // 1 cent in USDC

                return c.json({
                    error: 'Quota exceeded (credits required to continue)',
                    code: 'CREDITS_REQUIRED',
                    tier,
                    quota: usage.quota,
                    used: usage.used,
                    credits_required: OVERAGE_CREDITS_PER_REQUEST,
                    credits_balance: charge.balance,
                    topoff_url: '/topoff',
                    currentPlan: upgrade.currentPlan,
                    currentPlanDisplay: upgrade.currentPlanDisplay,
                    recommendedPlan: upgrade.recommendedPlan,
                    recommendedPlanDisplay: upgrade.recommendedPlanDisplay,
                    upgradeRequired: upgrade.upgradeRequired,
                    upgradeUrl: upgrade.upgradeUrl,
                    contactUrl: upgrade.contactUrl,
                    message: 'Top-off credits to continue instantly without downtime.'
                }, 402);
            }

            // Attach overage info
            c.set('overage', {
                charged_credits: OVERAGE_CREDITS_PER_REQUEST,
                credits_remaining: charge.balance
            });
        } else if (usage.exceeded) {
            return c.json(
                {
                    tier,
                    ...buildQuotaExceededPayload({
                        currentPlan: tier,
                        used: usage.used,
                        quota: usage.quota,
                    }),
                },
                429
            );
        }

        // Attach tier info to context
        c.set('apiKey', apiKey);
        c.set('tier', tier);
        c.set('tierFeatures', tierFeatures);
        c.set('usage', usage);
        return null; // Next
    } catch (error: any) {
        console.error('[Auth] Critical Security Failure:', error);
        // Fail-Closed Logic (Security Audit V2)
        // Do not allow unauthorized access on system failure.
        return c.json({
            error: 'Authentication Service Unavailable',
            details: 'The platform is currently experiencing a critical database or cache failure. Please try again shortly.'
        }, 503);
    }
}
