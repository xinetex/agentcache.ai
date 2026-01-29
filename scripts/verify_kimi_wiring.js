
const FETCH_URL = 'http://localhost:8787/api/moonshot'; // Pointing to local Dev server usually, but let's assume we test the endpoint logic locally if we can run it.
// Actually, since we can't spin up the server easily in this env, we might just mock the check or rely on unit logic.
// However, the user wants "capitalization". 
// Let's make this script purely for manual verification by the user against their deployed env.

const API_KEY = process.env.AGENTCACHE_API_KEY || 'ac_demo_test123';
// Note: This script assumes the server is running on localhost:8787 or deployed.
const TARGET_URL = process.env.TARGET_URL || 'http://localhost:8787/api/moonshot';

async function testKimiWiring() {
    console.log(`🚀 Verifying Kimi Wiring...`);
    console.log(`Target: ${TARGET_URL}`);

    try {
        const res = await fetch(TARGET_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY,
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                messages: [
                    { role: 'user', content: 'Explain why the sky is blue. Think step by step.' }
                ],
                model: 'moonshot-v1-8k', // Or specific thinking model
                cache_reasoning: true
            })
        });

        const data = await res.json();

        if (!res.ok) {
            console.error('❌ Request failed:', data);
            return;
        }

        console.log('✅ Response Received');
        console.log('--- Response Content ---');
        console.log(data.response?.slice(0, 100) + '...');

        console.log('--- Reasoning Content ---');
        if (data.reasoning_content) {
            console.log('🎉 FOUND REASONING CONTENT!');
            console.log(data.reasoning_content.slice(0, 200) + '...');
        } else {
            console.log('⚠️ No reasoning_content field found in API response.');
            console.log('Keys found:', Object.keys(data));
        }

    } catch (e) {
        console.error('❌ Error:', e.message);
    }
}

testKimiWiring();
