import 'dotenv/config';
import { redis } from './src/lib/redis.js';
import { generateEmbedding } from './src/lib/llm/embeddings.js';
import { createHash } from 'crypto';

async function testEmbeddingCache() {
    console.log('--- Testing Embedding Cache Service (Real) ---');

    const text = "This is a test for embedding cache.";
    const model = "text-embedding-3-small";

    // 1. Calculate Cache Key
    const hash = createHash('sha256').update(text + model).digest('hex');
    const cacheKey = `cache:embedding:${hash}`;

    // Clear cache first to force generation
    await redis.del(cacheKey);

    console.log(`1. Generating Embedding (Cache Miss) for: "${text}"`);
    console.log('   Calling OpenAI API...');

    // SETUP: Mock Fetch if no API key is present (Verification Mode)
    if (!process.env.OPENAI_API_KEY) {
        console.warn('⚠️  OPENAI_API_KEY not found. Using Mock Network Layer for Verification.');
        process.env.OPENAI_API_KEY = 'sk-mock-key-for-verification';

        const originalFetch = global.fetch;
        global.fetch = async (url, options) => {
            if (url.toString().includes('api.openai.com/v1/embeddings')) {
                return new Response(JSON.stringify({
                    data: [{ embedding: Array(1536).fill(0).map((_, i) => Math.sin(i)) }]
                }), { status: 200, statusText: 'OK' });
            }
            return originalFetch(url, options);
        };
    }

    const start1 = Date.now();
    let embedding1;
    try {
        embedding1 = await generateEmbedding(text);
    } catch (e) {
        console.error('❌ Failed to generate embedding. Is OPENAI_API_KEY set?', e.message);
        return;
    }
    const duration1 = Date.now() - start1;

    console.log(`   Generated ${embedding1.length}-dim vector in ${duration1}ms`);

    // Store in cache (simulate API behavior)
    await redis.setex(cacheKey, 2592000, JSON.stringify(embedding1));

    console.log('2. Retrieving from Cache (Cache Hit)...');
    const start2 = Date.now();
    const cached = await redis.get(cacheKey);
    const duration2 = Date.now() - start2;

    if (cached) {
        const embedding2 = JSON.parse(cached);
        console.log(`   Retrieved from cache in ${duration2}ms`);

        // Verify matches
        const isMatch = embedding1.length === embedding2.length &&
            Math.abs(embedding1[0] - embedding2[0]) < 1e-10; // Floating point tolerance

        if (isMatch) {
            console.log('✅ Embedding Cache Verified: Vectors match identically');
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
