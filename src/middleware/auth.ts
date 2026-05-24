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
import bcrypt from 'bcryptjs';
import { createClient } from '@vercel/postgres';
import { db } from '../db/client.js';
import { apiKeys, organizations } from '../db/schema.js';
import { redis } from '../lib/redis.js';
import { getTierQuota, getTierFeatures } from '../config/tiers.js';
import { eq } from 'drizzle-orm';
import { buildQuotaExceededPayload, getUpgradeDetails } from '../lib/upgrade-response.js';

// No hardcoded demo keys in production (Security Hardening Phase 35)

// Credits
const OVERAGE_CREDITS_PER_REQUEST = 1; // 1 credit = $0.01
const AUTH_PRINCIPAL_CACHE_TTL_SECONDS = Number(process.env.AUTH_PRINCIPAL_CACHE_TTL_SECONDS || 600);

type ResolvedPrincipalContext = {
    tier: string;
    orgId: string | null;
    userId: string | null;
    principalId: string | null;
    principalKind: 'agent' | 'organization' | 'user' | 'unknown';
    principalAgentId?: string | null;
};

function authPrincipalCacheKey(keyHash: string) {
    return `auth:principal:${keyHash}`;
}

function normalizeCachedPrincipal(raw: unknown): ResolvedPrincipalContext | null {
    if (!raw) return null;

    try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!parsed || typeof parsed !== 'object') return null;
        const record = parsed as Record<string, unknown>;
        const principalKind = record.principalKind;

        if (
            principalKind !== 'agent' &&
            principalKind !== 'organization' &&
            principalKind !== 'user' &&
            principalKind !== 'unknown'
        ) {
            return null;
        }

        return {
            tier: typeof record.tier === 'string' && record.tier ? record.tier : 'free',
            orgId: typeof record.orgId === 'string' ? record.orgId : null,
            userId: typeof record.userId === 'string' ? record.userId : null,
            principalId: typeof record.principalId === 'string' ? record.principalId : null,
            principalKind,
            principalAgentId: typeof record.principalAgentId === 'string' ? record.principalAgentId : null,
        };
    } catch {
        return null;
    }
}

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

function shouldAllowDemoApiKey() {
    return process.env.NODE_ENV === 'test' || !!process.env.VITEST || process.env.AGENTCACHE_FORCE_MOCK_DB === '1';
}

async function matchesStoredApiKey(apiKey: string, storedHash: string | null | undefined, exactHash: string) {
    if (!storedHash) return false;
    if (storedHash === exactHash) return true;
    if (storedHash.startsWith('$2')) {
        return bcrypt.compare(apiKey, storedHash);
    }
    return false;
}

async function resolveStoredPrincipalViaLegacySql(apiKey: string, keyHash: string, keyPrefix: string) {
    if (!process.env.DATABASE_URL || shouldAllowDemoApiKey()) {
        return null;
    }

    const client = createClient();

    try {
        await client.connect();

        const exactMatches = await client.query(
            `SELECT
                ak.key_hash AS hash,
                ak.key_prefix AS prefix,
                ak.is_active AS "isActive",
                ak.organization_id AS "orgId",
                ak.user_id AS "userId"
             FROM api_keys ak
             WHERE ak.key_hash = $1`,
            [keyHash]
        );

        const exact = exactMatches.rows.find((record: any) => record.isActive);
        if (exact) {
            let tier = 'free';

            if (exact.orgId) {
                const orgResult = await client.query(
                    `SELECT COALESCE(plan_tier, 'free') AS tier
                     FROM organizations
                     WHERE id = $1
                     LIMIT 1`,
                    [exact.orgId]
                ).catch(() => ({ rows: [] }));
                tier = orgResult.rows[0]?.tier || tier;
            }

            return {
                tier,
                orgId: exact.orgId || null,
                userId: exact.userId || null,
            };
        }

        const legacyCandidates = await client.query(
            `SELECT
                ak.key_hash AS hash,
                ak.key_prefix AS prefix,
                ak.is_active AS "isActive",
                ak.organization_id AS "orgId",
                ak.user_id AS "userId"
             FROM api_keys ak
             WHERE ak.key_prefix = $1`,
            [keyPrefix]
        );

        for (const record of legacyCandidates.rows) {
            if (!record.isActive || record.prefix !== keyPrefix) continue;
            const match = await matchesStoredApiKey(apiKey, record.hash, keyHash);
            if (!match) continue;

            let tier = 'free';
            if (record.orgId) {
                const orgResult = await client.query(
                    `SELECT COALESCE(plan_tier, 'free') AS tier
                     FROM organizations
                     WHERE id = $1
                     LIMIT 1`,
                    [record.orgId]
                ).catch(() => ({ rows: [] }));
                tier = orgResult.rows[0]?.tier || tier;
            }

            return {
                tier,
                orgId: record.orgId || null,
                userId: record.userId || null,
            };
        }
    } catch (error) {
        console.warn('[Auth] Legacy SQL key resolution failed, falling back to Drizzle:', error);
    } finally {
        await client.end().catch(() => {});
    }

    return null;
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

        // Derive settlement cost from request path and tier pricing
        // Default: 10.0 credits for standard API calls, adjustable per route
        const path = c.req.path || '';
        const isOntologyRoute = path.includes('/ontology/') || path.includes('/alignment/');
        const isCdnRoute = path.includes('/cdn/') || path.includes('/transcode/');
        const settlementCost = isOntologyRoute ? 25.0 : isCdnRoute ? 5.0 : 10.0;

        const settlement = await agentSettlementService.settle(preauthorization, agentId, settlementCost);

        if (settlement.success) {
            c.set('apiKey', agentId);
            c.set('principalAgentId', agentId);
            c.set('principalId', `agent:${agentId}`);
            c.set('principalKind', 'agent');
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

    if (shouldAllowDemoApiKey() && apiKey.startsWith('ac_demo_')) {
        c.set('apiKey', apiKey);
        c.set('principalAgentId', null);
        c.set('principalId', undefined);
        c.set('principalKind', 'unknown');
        c.set('tier', 'enterprise');
        c.set('tierFeatures', getTierFeatures('enterprise'));
        c.set('usage', { exceeded: false, used: 0, quota: -1, remaining: -1, keyHash: 'demo' });
        return null;
    }

    // Fetch tier from Postgres with Redis caching
    try {
        const keyHash = createHash('sha256').update(apiKey).digest('hex');
        const keyPrefix = apiKey.slice(0, 16);
        const cachedPrincipal = normalizeCachedPrincipal(await redis.get(authPrincipalCacheKey(keyHash)));

        const resolveStoredPrincipal = async () => {
            const exactMatches = await db
                .select({
                    hash: apiKeys.hash,
                    prefix: apiKeys.prefix,
                    tier: organizations.plan,
                    isActive: apiKeys.isActive,
                    orgId: apiKeys.orgId,
                    userId: apiKeys.userId,
                })
                .from(apiKeys)
                .leftJoin(organizations, eq(apiKeys.orgId, organizations.id))
                .where(eq(apiKeys.hash, keyHash));

            const exact = exactMatches.find((record) => record.isActive);
            if (exact) {
                return {
                    tier: exact.tier || 'free',
                    orgId: exact.orgId || null,
                    userId: exact.userId || null,
                };
            }

            const legacyCandidates = await db
                .select({
                    hash: apiKeys.hash,
                    prefix: apiKeys.prefix,
                    tier: organizations.plan,
                    isActive: apiKeys.isActive,
                    orgId: apiKeys.orgId,
                    userId: apiKeys.userId,
                })
                .from(apiKeys)
                .leftJoin(organizations, eq(apiKeys.orgId, organizations.id))
                .where(eq(apiKeys.prefix, keyPrefix));

            for (const record of legacyCandidates) {
                if (!record.isActive || record.prefix !== keyPrefix) continue;
                const match = await matchesStoredApiKey(apiKey, record.hash, keyHash);
                if (!match) continue;
                return {
                    tier: record.tier || 'free',
                    orgId: record.orgId || null,
                    userId: record.userId || null,
                };
            }

            const legacyResolved = await resolveStoredPrincipalViaLegacySql(apiKey, keyHash, keyPrefix);
            if (legacyResolved) {
                return legacyResolved;
            }

            return null;
        };

        let tier = 'free'; // default
        let tierFeatures = null;
        let principalAgentId: string | null = null;
        let principalId: string | null = null;
        let principalKind: 'agent' | 'organization' | 'user' | 'unknown' = 'unknown';

        if (cachedPrincipal) {
            tier = cachedPrincipal.tier;
            tierFeatures = getTierFeatures(tier);
            principalId = cachedPrincipal.principalId;
            principalKind = cachedPrincipal.principalKind;
            principalAgentId = cachedPrincipal.principalAgentId || null;
        } else {
            const storedPrincipal = await resolveStoredPrincipal();
            if (storedPrincipal) {
                tier = storedPrincipal.tier;
                tierFeatures = getTierFeatures(tier);

                if (storedPrincipal.orgId) {
                    principalId = `org:${storedPrincipal.orgId}`;
                    principalKind = 'organization';
                } else if (storedPrincipal.userId) {
                    principalId = `user:${storedPrincipal.userId}`;
                    principalKind = 'user';
                }
            }

            if (!principalId) {
                try {
                    const { agentRegistry } = await import('../lib/hub/registry.js');
                    principalAgentId = await agentRegistry.getAgentIdFromApiKey(apiKey) || null;
                    if (principalAgentId) {
                        principalId = `agent:${principalAgentId}`;
                        principalKind = 'agent';
                    }
                } catch (error) {
                    console.warn('[Auth] Failed to resolve principal agent ID:', error);
                }
            }

            if (principalId) {
                const orgId = principalKind === 'organization' ? principalId.replace(/^org:/, '') : storedPrincipal?.orgId || null;
                const userId = principalKind === 'user' ? principalId.replace(/^user:/, '') : storedPrincipal?.userId || null;
                await redis.setex(authPrincipalCacheKey(keyHash), AUTH_PRINCIPAL_CACHE_TTL_SECONDS, JSON.stringify({
                    tier,
                    orgId,
                    userId,
                    principalId,
                    principalKind,
                    principalAgentId,
                }));
            }
        }

        if (!principalId) {
            return c.json({
                error: 'Invalid or revoked API key',
                help: 'Generate a valid API key from the AgentCache dashboard before calling cache endpoints.'
            }, 401);
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
        c.set('principalAgentId', principalAgentId);
        c.set('principalId', principalId);
        c.set('principalKind', principalKind);
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

/**
 * Admin: Hardened internal access for the Industrial Ops Center.
 */
export async function authenticateAdmin(c: any) {
    const adminToken = c.req.header('X-Admin-Token') || c.req.header('Authorization')?.replace('Bearer ', '');
    const expectedToken = process.env.ADMIN_TOKEN;

    if (!expectedToken) {
        console.warn('[Auth] ADMIN_TOKEN not set in environment. Admin access is disabled.');
        return c.json({ error: 'Admin access disabled (Configuration Error)' }, 503);
    }

    if (adminToken !== expectedToken) {
        // Prevent brute force or exploration by returning generic 403
        return c.json({ error: 'Unauthorized: Admin access required' }, 403);
    }

    return null; // Next
}
