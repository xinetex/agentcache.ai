/**
 * Rate Limiter for AgentCache AI
 * 
 * Implements a Fixed Window Counter using Upstash Redis.
 * Default Limit: 60 requests per minute per API key.
 * 
 * Usage:
 * const allowed = await RateLimiter.check(apiKeyHash, 60);
 * if (!allowed) return 429;
 */

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Lightweight Redis fetcher to avoid heavy deps
async function redis(command, ...args) {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;

    try {
        const response = await fetch(`${UPSTASH_URL}/${command}/${args.join('/')}`, {
            headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
        });
        const data = await response.json();
        return data.result;
    } catch (e) {
        console.error('RateLimiter Redis Error:', e);
        return null; // Fail open if Redis is down
    }
}

export const RateLimiter = {
    /**
     * Check if request is allowed.
     * @param {string} keyHash - Hash of the API Key or Identifier
     * @param {number} limit - Max requests per window (default 60)
     * @param {number} windowSeconds - Window size in seconds (default 60)
     * @returns {Promise<boolean>} true if allowed, false if blocked
     */
    async check(keyHash, limit = 60, windowSeconds = 60) {
        // demo keys are unlimited
        if (keyHash === 'demo') return true;

        const now = Math.floor(Date.now() / 1000);
        const windowKey = Math.floor(now / windowSeconds);
        const redisKey = `ratelimit:${keyHash}:${windowKey}`;

        try {
            // INCR returns the new value
            const currentCount = await redis('INCR', redisKey);

            // If this is the first request in window, set expiry
            if (currentCount === 1) {
                await redis('EXPIRE', redisKey, windowSeconds);
            }

            return currentCount <= limit;
        } catch (e) {
            // If Redis fails, fail open (allow traffic)
            return true;
        }
    }
};
