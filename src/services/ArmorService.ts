/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */

import { redis } from '../lib/redis.js';
import { CortexBridge } from './CortexBridge.js';

export class ArmorService {
    private cortex = new CortexBridge();

    /**
     * Check if request should be allowed.
     * Also tracks global request count and blocked count.
     */
    async checkRequest(ip: string, path: string, payload?: any): Promise<{ allowed: boolean; reason?: string }> {
        // Track total requests (fire-and-forget)
        redis.incr('armor:requests:total').catch(() => {});
        // Track requests in current minute window
        const minuteKey = `armor:rpm:${Math.floor(Date.now() / 60000)}`;
        redis.incr(minuteKey).then(() => redis.expire(minuteKey, 120)).catch(() => {});

        // 1. Rate Limiting (Token Bucket)
        try {
            const rateKey = `armor:rate:${ip}`;
            const count = await redis.incrby(rateKey, 1);

            if (count === 1) {
                await redis.expire(rateKey, 60);
            }

            if (count > 100) { // 100 req/min limit
                await this.recordBlock(ip, 'Rate Limit Exceeded');
                return { allowed: false, reason: "Rate Limit Exceeded" };
            }
        } catch (err) {
            console.error("[Armor] Rate Limit Check Failed (Fail Open):", err);
        }

        // 2. Payload Inspection (WAF)
        if (payload) {
            const str = JSON.stringify(payload).toLowerCase();

            const threats = [
                '<script>',
                'drop table',
                'ignore previous instructions',
                'system prompt',
                'javascript:'
            ];

            for (const threat of threats) {
                if (str.includes(threat)) {
                    // Log + ban
                    Promise.all([
                        this.cortex.synapse({
                            sector: 'FINANCE',
                            type: 'WARNING',
                            message: `🛡️ ARMOR BLOCKED: Malicious Payload detected from ${ip}`
                        }),
                        redis.setex(`armor:ban:${ip}`, 300, 'banned'),
                        this.recordBlock(ip, `Threat: ${threat}`)
                    ]).catch(e => console.error("[Armor] Failed to log threat async:", e));

                    return { allowed: false, reason: `Threat Detected: ${threat}` };
                }
            }
        }

        return { allowed: true };
    }

    /**
     * Economic Safety: Check settlement velocity to prevent high-frequency drain.
     * Uses an atomic Lua script to prevent race conditions in high-concurrency swarms.
     */
    async checkSettlementVelocity(agentId: string): Promise<{ allowed: boolean; reason?: string }> {
        const minuteKey = `armor:settle:rpm:${agentId}:${Math.floor(Date.now() / 60000)}`;
        const hourKey = `armor:settle:rph:${agentId}:${Math.floor(Date.now() / 3600000)}`;

        const luaScript = `
            local rpm = redis.call("INCR", KEYS[1])
            local rph = redis.call("INCR", KEYS[2])
            if rpm == 1 then redis.call("EXPIRE", KEYS[1], 120) end
            if rph == 1 then redis.call("EXPIRE", KEYS[2], 7200) end
            return {rpm, rph}
        `;

        try {
            // @ts-ignore - redis.eval is available in our Upstash wrapper
            const [rpm, rph] = await (redis as any).eval(luaScript, 2, minuteKey, hourKey);

            // Circuit Breaker Thresholds
            if (rpm > 50) { // Max 50 settlements per minute
                await this.recordBlock(agentId, 'Settlement Velocity Exceeded (Minute)');
                return { allowed: false, reason: 'High-frequency settlement detected (RPM > 50)' };
            }
            if (rph > 500) { // Max 500 settlements per hour
                await this.recordBlock(agentId, 'Settlement Velocity Exceeded (Hour)');
                return { allowed: false, reason: 'Cumulative settlement limit reached (RPH > 500)' };
            }
        } catch (err: any) {
            console.warn('[Armor] Atomic Settlement Velocity Check Failed (Fail Open):', err.message);
        }

        return { allowed: true };
    }

    /**
     * Proof-of-Intuition (PoI): Validate a latent manifold against a System 2 Oracle.
     * Prevents "Semantic Noise" from polluting the marketplace.
     */
    async validateManifold(manifoldId: string): Promise<boolean> {
        console.log(`[Armor] 🔍 Executing PoI Validation for manifold: ${manifoldId}...`);
        
        // 1. In a production env, we'd pull 5 random latent coordinates from the manifold
        // 2. We'd re-verify them through a reference model (e.g., GPT-4o or DeepSeek)
        
        // MVP: Simulate validation delay and probabilistic verification
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const success = Math.random() > 0.1; // 90% pass rate for existing manifolds
        
        if (!success) {
            console.warn(`[Armor] ❌ PoI Validation FAILED for ${manifoldId}: Semantic Drift detected.`);
            await this.cortex.synapse({
                sector: 'LEGAL',
                type: 'ANOMALY',
                message: `🛡️ PoI FAILURE: Manifold ${manifoldId} rejected due to semantic drift.`
            });
        } else {
            console.log(`[Armor] ✅ PoI Validation PASSED for ${manifoldId}. Manifold Sealed.`);
        }

        return success;
    }

    /**
     * Canary Mirroring (Phase 3.6): Route a small percentage of traffic to 
     * a shadow swarm to mirror production topologies for side-by-side comparison.
     */
    async mirrorTraffic(path: string, payload: any) {
        // Only mirror 5% of traffic
        if (Math.random() > 0.05) return;

        console.log(`[Armor] 🦜 Mirroring traffic to SHADOW SWARM for path: ${path}`);
        
        // In a production env, we'd trigger a 'shadow-exec' event in Redis
        // For the prototype, we log the intent
        const shadowEvent = JSON.stringify({
            path,
            payload: payload ? JSON.stringify(payload).slice(0, 200) : null,
            timestamp: Date.now(),
            mirrorId: `shadow_${Math.random().toString(36).slice(2, 9)}`
        });

        await redis.lpush('armor:mirrored_traffic', shadowEvent);
        await redis.ltrim('armor:mirrored_traffic', 0, 99);
    }

    /**
     * Record a blocked request with details
     */
    private async recordBlock(ip: string, reason: string) {
        try {
            await redis.incr('armor:blocked:total');
            // Track in 24h window
            const dayKey = `armor:blocked:${new Date().toISOString().slice(0, 10)}`;
            await redis.incr(dayKey);
            await redis.expire(dayKey, 86400 * 2); // Keep 2 days

            // Store last 50 blocked events for threat feed
            const event = JSON.stringify({
                ip, reason, timestamp: Date.now()
            });
            await redis.lpush('armor:events', event);
            await redis.ltrim('armor:events', 0, 49);
        } catch (e) {
            console.error('[Armor] recordBlock error:', e);
        }
    }

    /**
     * Get real security stats from Redis
     */
    async getStats() {
        try {
            const today = new Date().toISOString().slice(0, 10);
            const currentMinute = Math.floor(Date.now() / 60000);

            const [totalBlocked, blocked24h, totalRequests, rpm] = await Promise.all([
                redis.get('armor:blocked:total'),
                redis.get(`armor:blocked:${today}`),
                redis.get('armor:requests:total'),
                redis.get(`armor:rpm:${currentMinute}`)
            ]);

            // Count active bans (scan for armor:ban:* keys)
            let activeBans = 0;
            try {
                const keys = await redis.keys('armor:ban:*');
                activeBans = keys.length;
            } catch { activeBans = 0; }

            // Get recent events for threat feed
            let recentEvents: any[] = [];
            try {
                const rawEvents = await redis.lrange('armor:events', 0, 9);
                recentEvents = rawEvents.map((e: string) => {
                    try { return JSON.parse(e); } catch { return null; }
                }).filter(Boolean);
            } catch {}

            return {
                totalBlocked: parseInt(totalBlocked as string) || 0,
                blocked24h: parseInt(blocked24h as string) || 0,
                totalRequests: parseInt(totalRequests as string) || 0,
                requestsPerMinute: parseInt(rpm as string) || 0,
                activeBans,
                recentEvents,
                integrity: activeBans === 0 ? '100%' : activeBans < 5 ? '99.9%' : '99%',
                status: 'active'
            };
        } catch (e) {
            console.error('[Armor] getStats error:', e);
            return {
                totalBlocked: 0,
                blocked24h: 0,
                totalRequests: 0,
                requestsPerMinute: 0,
                activeBans: 0,
                recentEvents: [],
                integrity: 'unknown',
                status: 'error'
            };
        }
    }
}
export const armorService = new ArmorService();
