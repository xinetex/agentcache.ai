
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

