
const FETCH_URL = 'https://agentcache.ai/api/agent/chat';
const API_KEY = 'ac_demo_test123';

async function testProvider(provider, model) {
    console.log(`Testing provider: ${provider}...`);
    try {
        const res = await fetch(FETCH_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            },
            body: JSON.stringify({
                sessionId: `test-${Date.now()}`,
                message: 'Hello, who are you?',
                provider: provider,
                model: model
            })
        });

        const data = await res.json();

        if (data.error) {
            console.error(`[FAIL] ${provider}:`, data.error);
        } else if (data.response) {
            console.log(`[PASS] ${provider}: Response received.`);
            console.log(`       Provider in metadata: ${data.metadata?.provider}`);
            // console.log(`       Preview: ${data.response.substring(0, 50)}...`);
        } else {
            console.warn(`[WARN] ${provider}: Unknown response structure`, data);
        }
    } catch (e) {
        console.error(`[ERR] ${provider}:`, e.message);
    }
}

async function run() {
    await testProvider('grok', 'grok-beta');
    await testProvider('perplexity', 'sonar-pro');
}

run();
