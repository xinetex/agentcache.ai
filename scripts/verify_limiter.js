
// Mock Env Vars BEFORE import
process.env.UPSTASH_REDIS_REST_URL = 'https://mock-redis';
process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-token';

// Use dynamic import to verify env vars are visible to the module
async function testLimiter() {
    const { RateLimiter } = await import('../api/limiter.js');

    console.log('🚦 Testing Rate Limiter...');

    // Mock fetch to simulate Redis
    const memoryStore = {};
    const originalFetch = global.fetch;

    global.fetch = async (url) => {
        // console.log('DEBUG Fetch:', url); 
        if (url.toString().match(/\/incr\//i)) {
            const key = url.toString().split('/').pop();
            const val = (memoryStore[key] || 0) + 1;
            memoryStore[key] = val;
            return { json: async () => ({ result: val }) };
        }
        if (url.toString().match(/\/expire\//i)) {
            return { json: async () => ({ result: 1 }) };
        }
        return { json: async () => ({ result: null }) };
    };

    const key = 'test-limit-key-v2';
    const limit = 5;

    console.log(`\nBursting ${limit + 2} requests (Limit: ${limit})...`);

    for (let i = 1; i <= limit + 2; i++) {
        const allowed = await RateLimiter.check(key, limit);
        const status = allowed ? '✅ Allowed' : '⛔ Blocked';
        console.log(`Req ${i}: ${status}`);

        if (i <= limit && !allowed) console.error(`❌ FAIL: Req ${i} should be allowed`);
        if (i > limit && allowed) console.error(`❌ FAIL: Req ${i} should be blocked`);
    }

    // Restore fetch
    global.fetch = originalFetch;
}

testLimiter();
