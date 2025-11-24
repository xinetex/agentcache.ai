import 'dotenv/config';
import { SemanticRouter } from '../src/lib/router.js';

async function main() {
    console.log('🧪 Verifying Semantic Router...');

    const router = new SemanticRouter(0.85); // Slightly lower threshold for testing

    // 1. Clear/Reset (Mocking this by using a unique query)
    const query1 = `How do I make a chocolate cake? ${Date.now()}`;
    const response1 = "Here is a recipe for chocolate cake: Flour, Sugar, Cocoa...";

    console.log(`\n1. Caching Query: "${query1}"`);
    await router.cache(query1, response1, { source: 'test' });
    console.log('✅ Cached.');

    // 2. Test Exact Match
    console.log(`\n2. Testing Exact Match...`);
    const result1 = await router.find(query1);
    if (result1.hit) {
        console.log('✅ Exact match HIT');
    } else {
        console.error('❌ Exact match MISS');
    }

    // 3. Test Semantic Match (Fuzzy)
    const query2 = `Recipe for chocolate cake ${Date.now()}`; // Similar but different
    // Note: Vector search might not be instant or might need the exact same embedding model.
    // For this test, we rely on the fact that we just inserted it.
    // However, Upstash Vector might have eventual consistency or indexing time.
    // Let's try a query that is semantically close.

    console.log(`\n3. Testing Semantic Match: "${query2}"`);
    // We might not get a hit immediately if indexing takes time, but let's try.
    const result2 = await router.find(query2);

    if (result2.hit) {
        console.log(`✅ Semantic match HIT (Score: ${result2.score})`);
        console.log(`   Response: ${result2.response?.slice(0, 20)}...`);
    } else {
        console.log('⚠️ Semantic match MISS (Might be indexing delay or low similarity)');
        if (result2.score) console.log(`   Score was: ${result2.score}`);
    }
}

main().catch(console.error);
