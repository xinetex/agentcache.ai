
import { createHash } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { db } from '../db/client.js';
import { apiKeys, organizations } from '../db/schema.js';
import { redis } from '../lib/redis.js';
import { getTierQuota, getTierFeatures } from '../config/tiers.js';
import { eq } from 'drizzle-orm';

// Demo API keys (for MVP testing)
const DEMO_API_KEYS = new Set([
    'ac_demo_test123',
    'ac_demo_test456',
]);

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
        return { exceeded: true, used, quota, remaining: 0 };
    }

    return { exceeded: false, used, quota, remaining: quota === -1 ? -1 : quota - used };
}

// Middleware: API Key auth with tier enforcement and usage tracking
export async function authenticateApiKey(c: any) {
    const apiKey = c.req.header('X-API-Key') || c.req.header('Authorization')?.replace('Bearer ', '');

    if (!apiKey || !apiKey.startsWith('ac_')) {
        // Return error if no key, but allow next() if used as optional/middleware chain? 
        // Current usage returns response immediately (acting as a guard).
        return c.json({
            error: 'Invalid or missing API key',
            help: 'Get your API key at https://agentcache.ai/#signup'
        }, 401);
    }

    // For MVP: Accept demo keys (unlimited usage)
    if (DEMO_API_KEYS.has(apiKey)) {
        c.set('apiKey', apiKey);
        c.set('tier', 'enterprise');
        c.set('tierFeatures', getTierFeatures('enterprise'));
        c.set('usage', { used: 0, quota: -1, remaining: -1 });
        return null; // continue
    }

    // Fetch tier from Postgres with Redis caching
    try {
        const keyHash = createHash('sha256').update(apiKey).digest('hex');
        const cacheKey = `tier:${keyHash}`;

        let tier = 'free'; // default
        let tierFeatures = null;

        // Check Redis cache first (5 min TTL)
        const cachedTier = await redis.get(cacheKey);
        if (cachedTier) {
            tier = cachedTier;
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

        if (usage.exceeded) {
            return c.json({
                error: 'Monthly quota exceeded',
                quota: usage.quota,
                used: usage.used,
                tier: tier,
                message: tier === 'free'
                    ? 'Your free tier includes 10,000 requests/month. Upgrade to Pro for 1M requests/month.'
                    : 'Monthly quota exceeded. Contact support to upgrade your plan.'
            }, 429);
        }

        // Attach tier info to context
        c.set('apiKey', apiKey);
        c.set('tier', tier);
        c.set('tierFeatures', tierFeatures);
        c.set('usage', usage);
        return null; // Next
    } catch (error: any) {
        console.error('[Auth] Error:', error);
        // On critical DB failure, we can either fail open (free tier) or closed.
        // Failing open allows site to work even if DB is down.
        c.set('apiKey', apiKey);
        c.set('tier', 'free');
        c.set('tierFeatures', getTierFeatures('free'));
        return null;
    }
}
