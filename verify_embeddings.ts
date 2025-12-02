import 'dotenv/config';
import { redis } from './src/lib/redis.js';

async function testEmbeddingCache() {
    console.log('--- Testing Embedding Cache Service ---');

    // Mock request to API (since we can't easily spin up a server in this script)
    // We will test the logic by importing the handler if possible, or just testing the underlying components.
    // Since the handler is an edge function default export, it's hard to test directly without a server.
    // So we will test the shared utility and the Redis caching logic directly, simulating what the API does.

    // Mock generateEmbedding to test caching logic without API key dependency
    const generateEmbedding = async (text) => {
        return Array(1536).fill(0).map(() => Math.random());
    };
    const { createHash } = await import('crypto');

    const text = "This is a test for embedding cache.";
    const model = "text-embedding-3-small";

    // 1. Simulate API Logic: Check Cache
    const hash = createHash('sha256').update(text + model).digest('hex');
    const cacheKey = `cache:embedding:${hash}`;

    // Clear cache first
    await redis.del(cacheKey);

    console.log('1. First Call (Cache Miss)...');
    const start1 = Date.now();
    const embedding1 = await generateEmbedding(text);
    const duration1 = Date.now() - start1;
    console.log(`Generated embedding in ${duration1}ms`);

    // Store in cache
    await redis.setex(cacheKey, 2592000, JSON.stringify(embedding1));

    console.log('2. Second Call (Cache Hit)...');
    const start2 = Date.now();
    const cached = await redis.get(cacheKey);
    const duration2 = Date.now() - start2;

    if (cached) {
        const embedding2 = JSON.parse(cached);
        console.log(`Retrieved from cache in ${duration2}ms`);

        if (embedding1.length === embedding2.length && embedding1[0] === embedding2[0]) {
            console.log('✅ Embedding Cache Verified: Vectors match');
        } else {
            console.error('❌ Embedding Cache Failed: Vectors do not match');
        }
    } else {
        console.error('❌ Embedding Cache Failed: Cache miss on second call');
    }
}

async function main() {
    try {
        await testEmbeddingCache();
    } catch (err) {
        console.error('Test failed:', err);
    } finally {
        redis.disconnect();
    }
}

main();
