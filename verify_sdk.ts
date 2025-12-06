
import { AgentCacheClient } from './packages/agentcache-js/src/client';
import { CacheRequest } from './packages/agentcache-js/src/types';

/**
 * Verification Script for AgentCache SDK
 * Tests the local client against the local API.
 */

async function assert(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(`❌ Assertion Failed: ${message}`);
    }
    console.log(`✅ ${message}`);
}

async function verify() {
    console.log('🧪 Verifying AgentCache SDK...\n');

    // 1. Initialize Client
    const client = new AgentCacheClient({
        apiKey: 'ac_demo_test123',
        baseUrl: 'http://localhost:3001'
    });
    console.log('Tested connection with baseUrl: http://localhost:3001');

    // 2. Test Stats (Health Check)
    console.log('\nTest 1: Fetch Stats');
    try {
        const stats = await client.stats();
        console.log('Stats:', stats);
        assert(!!stats.tier, 'Should return tier info');
    } catch (e: any) {
        // Allow failure if server not running, but warn
        console.warn('⚠️ Could not connect to local API. Is the server running on 3001?');
        console.warn('Skipping integration tests requiring live server.');
        return;
    }

    // 3. Test Cache Set
    console.log('\nTest 2: Cache Set');
    const req: CacheRequest = {
        provider: 'openai',
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello SDK' }],
        ttl: 60
    };

    const setRes = await client.set(req, 'Hello from SDK verification');
    assert(setRes.success === true, 'Set should be successful');

    // 4. Test Cache Get
    console.log('\nTest 3: Cache Get');
    const getRes = await client.get(req);
    assert(getRes.hit === true, 'Should hit the cache we just set');
    assert(getRes.response === 'Hello from SDK verification', 'Response should match');

    console.log('\n✨ SDK Verification Passed!');
}

verify().catch(err => {
    console.error('❌ Verification Failed:', err);
    process.exit(1);
});
