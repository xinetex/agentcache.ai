import handler from '../api/studio/stats.js';

// Mock environment
process.env.UPSTASH_REDIS_REST_URL = 'mock-url';
process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-token';

// Mock fetch
global.fetch = async (url) => {
    if (url.includes('stats%3Atotal_requests')) return { ok: true, json: async () => ({ result: '1500' }) };
    if (url.includes('stats%3Acache_hits')) return { ok: true, json: async () => ({ result: '1400' }) };
    if (url.includes('agents%3Aactive')) return { ok: true, json: async () => ({ result: 42 }) }; // SCARD returns number
    return { ok: false };
};

async function runTest() {
    console.log('🧪 Testing Studio Stats API...');

    const req = { method: 'GET' };

    try {
        const res = await handler(req);
        const data = await res.json();

        console.log('Response:', JSON.stringify(data, null, 2));

        let passed = true;

        if (data.system && data.system.cpu >= 20) {
            console.log('✅ System Stats: PASSED');
        } else {
            console.error('❌ System Stats: FAILED');
            passed = false;
        }

        if (data.agents.connected === 42) {
            console.log('✅ Agent Stats: PASSED');
        } else {
            console.error('❌ Agent Stats: FAILED');
            passed = false;
        }

        if (data.graph && data.graph.nodes.length > 0) {
            console.log('✅ Graph Data: PASSED');
        } else {
            console.error('❌ Graph Data: FAILED');
            passed = false;
        }

        if (passed) {
            console.log('✨ Studio API Verification Successful!');
            process.exit(0);
        } else {
            console.error('💥 Studio API Verification Failed');
            process.exit(1);
        }

    } catch (error) {
        console.error('Test Error:', error);
        process.exit(1);
    }
}

runTest();
