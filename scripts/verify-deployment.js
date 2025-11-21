

const API_BASE = 'https://agentcache.ai';
const API_KEY = 'ac_demo_test123';

async function runTests() {
    console.log('🧪 Starting Verification Tests...');

    // 1. Test Cache Set & Get with Metadata
    console.log('\nTest 1: Cache Metadata & Freshness');
    const cacheKey = `test-key-${Date.now()}`;

    // SET
    const setRes = await fetch(`${API_BASE}/api/cache/set`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY, 'X-Source-Url': 'https://example.com/source' },
        body: JSON.stringify({
            provider: 'openai',
            model: 'gpt-4',
            messages: [{ role: 'user', content: cacheKey }],
            response: 'Cached response content',
            ttl: 3600
        })
    });
    const setData = await setRes.json();
    console.log('SET Status:', setRes.status);

    if (!setData.success) {
        console.error('❌ SET failed:', setData);
        process.exit(1);
    }

    // GET
    const getRes = await fetch(`${API_BASE}/api/cache/get`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
        body: JSON.stringify({
            provider: 'openai',
            model: 'gpt-4',
            messages: [{ role: 'user', content: cacheKey }]
        })
    });
    const getData = await getRes.json();
    console.log('GET Status:', getRes.status);

    if (getData.hit && getData.freshness) {
        console.log('✅ Cache Hit with Freshness:', getData.freshness);
    } else {
        console.error('❌ Missing freshness data:', getData);
        // Don't exit, continue to other tests
    }

    // 2. Test Listener Registration
    console.log('\nTest 2: Listener Registration');
    const regRes = await fetch(`${API_BASE}/api/listeners/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
        body: JSON.stringify({
            url: 'https://example.com',
            checkInterval: 3600000,
            namespace: 'verification-test'
        })
    });
    const regData = await regRes.json();
    console.log('Register Status:', regRes.status);

    if (regData.success) {
        console.log('✅ Listener Registered:', regData.listenerId);

        // Cleanup
        await fetch(`${API_BASE}/api/listeners/register?id=${regData.listenerId}`, {
            method: 'DELETE',
            headers: { 'X-API-Key': API_KEY }
        });
        console.log('✅ Listener Unregistered');
    } else {
        console.error('❌ Registration failed:', regData);
    }

    // 3. Test Invalidation
    console.log('\nTest 3: Invalidation');
    const invRes = await fetch(`${API_BASE}/api/cache/invalidate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
        body: JSON.stringify({
            pattern: 'test/*',
            reason: 'verification'
        })
    });
    const invData = await invRes.json();
    console.log('Invalidation Status:', invRes.status);
    console.log('Invalidation Result:', invData);

    console.log('\n🎉 Verification Complete');
}

runTests().catch(console.error);
