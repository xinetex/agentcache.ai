import 'dotenv/config';
import { redis } from '../src/lib/redis.js';
import { CognitiveEngine } from '../src/infrastructure/CognitiveEngine.js';

async function testDeepAgent() {
    const sessionId = `test-deep-agent-${Date.now()}`;
    const L2_PREFIX = `agentcache:session:${sessionId}:list`;
    const engine = new CognitiveEngine();

    console.log(`🤖 Testing DeepAgent for Session: ${sessionId}`);

    // 1. Seed L2 with 15 items (Threshold is 10)
    console.log('🌱 Seeding L2 Cache with 15 items...');
    for (let i = 0; i < 15; i++) {
        await redis.rpush(L2_PREFIX, JSON.stringify({ role: 'user', content: `Message ${i}` }));
    }

    const initialCount = await redis.llen(L2_PREFIX);
    console.log(`📊 Initial L2 Count: ${initialCount}`);

    if (initialCount !== 15) {
        console.error('❌ Seeding failed.');
        process.exit(1);
    }

    // 2. Trigger Optimization
    console.log('🧠 Running DeepAgent Optimizer...');
    const result = await engine.optimizeMemory(sessionId, redis);

    console.log('📝 Optimization Result:', result);

    // 3. Verify Demotion
    const finalCount = await redis.llen(L2_PREFIX);
    console.log(`📊 Final L2 Count: ${finalCount}`);

    if (finalCount === 10 && result.demoted === 5) {
        console.log('✅ SUCCESS: DeepAgent correctly demoted 5 items to maintain L2 threshold.');
    } else {
        console.error('❌ FAILURE: Optimization logic incorrect.');
        console.error(`Expected 10 items, found ${finalCount}`);
        console.error(`Expected 5 demoted, found ${result.demoted}`);
        process.exit(1);
    }

    // Cleanup
    await redis.del(L2_PREFIX);
    process.exit(0);
}

testDeepAgent().catch(err => {
    console.error(err);
    process.exit(1);
});
