
import { redis } from '../lib/redis.js';
import { CortexBridge } from './CortexBridge.js';

export class ArmorService {
    private cortex = new CortexBridge();

    /**
     * Check if request should be allowed.
     * Returns TRUE if allowed, FALSE if blocked.
     */
    async checkRequest(ip: string, path: string, payload?: any): Promise<{ allowed: boolean; reason?: string }> {
        // 1. Rate Limiting (Token Bucket)
        // Key: rate:ip (TTL 60s)
        const rateKey = `armor:rate:${ip}`;
        const count = await redis.incrby(rateKey, 1);

        if (count === 1) {
            await redis.expire(rateKey, 60);
        }

        if (count > 100) { // 100 req/min limit
            return { allowed: false, reason: "Rate Limit Exceeded" };
        }

        // 2. Payload Inspection (WAF)
        if (payload) {
            const str = JSON.stringify(payload).toLowerCase();

            // XSS / Injection / System Prompt Leaking vectors
            const threats = [
                '<script>',
                'drop table',
                'ignore previous instructions',
                'system prompt',
                'javascript:'
            ];

            for (const threat of threats) {
                if (str.includes(threat)) {
                    // Log Attack to Cortex
                    await this.cortex.synapse({
                        sector: 'FINANCE', // Using Finance/Risk channel for Security for now
                        type: 'WARNING',
                        message: `🛡️ ARMOR BLOCKED: Malicious Payload detected from ${ip}`
                    });

                    // Ban IP temporarily
                    await redis.setex(`armor:ban:${ip}`, 300, 'banned');

                    return { allowed: false, reason: `Threat Detected: ${threat}` };
                }
            }
        }

        return { allowed: true };
    }

    async getStats() {
        // Mock stats for UI
        return {
            threats_blocked: 24,
            active_bans: 1,
            integrity: '99.9%'
        };
    }
}
