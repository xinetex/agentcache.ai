import 'dotenv/config';
import { SwarmNode } from './src/lib/swarm/protocol.js';
import { LLMFactory } from './src/lib/llm/factory.js';
import { redis } from './src/lib/redis.js';

async function testSwarm() {
    console.log('--- Testing Swarm Protocol ---');
    const agent1 = new SwarmNode('agent-1', ['coding']);
    const agent2 = new SwarmNode('agent-2', ['review']);

    await agent1.join();
    await agent2.join();

    // Mock Redis subscribe for testing (since we can't easily spawn processes here)
    // In a real scenario, agent2 would be listening on 'swarm:tasks'
    const taskId = await agent1.broadcastTask('code_review', { file: 'test.ts' });
    console.log(`Task broadcasted: ${taskId}`);

    await agent2.bidForTask(taskId, 0.95);
    console.log(`Agent 2 bid on task ${taskId}`);

    await agent2.submitResult(taskId, { status: 'LGTM' });
    console.log(`Agent 2 submitted result for ${taskId}`);
}

async function testToolCache() {
    console.log('\n--- Testing Tool Caching ---');

    // Mock Moonshot provider to avoid real API calls if key is missing
    // But LLMFactory will try to create one.
    // Let's assume we can create a dummy provider or just test the decorator.

    // Actually, let's test the decorator directly first
    const { withToolCache } = await import('./src/lib/cache/tool.js');

    let callCount = 0;
    const expensiveTool = async (arg) => {
        callCount++;
        await new Promise(resolve => setTimeout(resolve, 100));
        return { result: arg * 2, timestamp: Date.now() };
    };

    const cachedTool = withToolCache('test-tool', expensiveTool, { ttl: 60 });

    console.log('1. First call (MISS)...');
    const res1 = await cachedTool(10);
    console.log('Result 1:', res1);

    console.log('2. Second call (HIT)...');
    const res2 = await cachedTool(10);
    console.log('Result 2:', res2);

    if (callCount === 1 && res1.timestamp === res2.timestamp) {
        console.log('✅ Tool Caching Verified: Call count is 1');
    } else {
        console.error('❌ Tool Caching Failed: Call count is', callCount);
    }
}

async function main() {
    try {
        await testSwarm();
        await testToolCache();
    } catch (err) {
        console.error('Test failed:', err);
    } finally {
        redis.disconnect();
    }
}

main();
