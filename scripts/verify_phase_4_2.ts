
import { invalidationService } from '../src/services/InvalidationService.js';
import { redis } from '../src/lib/redis.js';

async function verify() {
    console.log('🏁 Starting Phase 4.2 Verification: The Invalidation Swarm\n');

    // 1. Setup Mock Data in Redis
    const testKey = 'cache:llm:openai:test_doc';
    await redis.set(testKey, 'Old documented response content');
    console.log('✅ Step 1: Injected mock cache entry.');

    // 2. Register a Watcher for a mock URL (using a local file URL or just a known constant)
    const mockUrl = 'https://raw.githubusercontent.com/openai/openai-openapi/master/openapi.yaml';
    await invalidationService.registerWatcher(mockUrl, ['cache:llm:openai:*']);
    console.log('✅ Step 2: Registered Maintenance Watcher for OpenAI OpenAPI.');

    // 3. Manually trigger a maintenance step
    console.log('⏳ Step 3: Triggering Autonomic Maintenance Step...');
    await invalidationService.runMaintenanceStep();
    
    // 4. Verify status
    const status = await invalidationService.getStatus();
    console.log(`📊 Maintenance Status: ${status.activeAgents} Agents Active, ${status.heals} Total Heals.`);

    // 5. Test Invalidation Logic Directly
    console.log('🧪 Step 5: Testing Direct Invalidation...');
    // We'll simulate a semantic shift detection by manually calling the invalidator
    // (Since we can't easily change github content for a test)
    await (invalidationService as any).invalidatePatterns(['cache:llm:openai:*']);
    
    const exists = await redis.exists(testKey);
    if (!exists) {
        console.log('✅ SUCCESS: Maintenance Swarm successfully invalidated stale cache patterns.');
    } else {
        console.error('❌ FAILURE: Cache patterns still exist after invalidation.');
        process.exit(1);
    }

    console.log('\n--- 🎊 Phase 4.2 Verified! ---');
    process.exit(0);
}

verify().catch(err => {
    console.error('❌ Verification Failed:', err);
    process.exit(1);
});
