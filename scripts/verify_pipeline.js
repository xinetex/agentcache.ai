import handler from '../api/agent/chat.js';

// Mock environment
process.env.MOONSHOT_API_KEY = 'mock-key';

// Mock fetch
global.fetch = async (url, options) => {
    console.log(`[MockFetch] ${url}`);
    if (url.includes('moonshot')) {
        return {
            ok: true,
            json: async () => ({
                choices: [{ message: { content: 'Mocked response from Moonshot' } }],
                usage: { prompt_tokens: 10, completion_tokens: 10, reasoning_tokens: 50 },
                created: Date.now() / 1000
            })
        };
    }
    return { ok: false, status: 404 };
};

async function runTest() {
    console.log('🧪 Testing Pipeline...');

    // Test PII Redaction
    const req = {
        method: 'POST',
        json: async () => ({
            message: 'My SSN is 123-45-6789 and email is test@example.com',
            sessionId: 'test-session'
        })
    };

    try {
        const res = await handler(req);
        const data = await res.json();

        console.log('Response:', JSON.stringify(data, null, 2));

        let passed = true;

        if (data.metrics.piiRedacted === true) {
            console.log('✅ PII Redaction: PASSED');
        } else {
            console.error('❌ PII Redaction: FAILED');
            passed = false;
        }

        if (data.metrics.actualReasoningTokens === 50) {
            console.log('✅ Reasoning Tokens: PASSED');
        } else {
            console.error('❌ Reasoning Tokens: FAILED');
            passed = false;
        }

        if (passed) {
            console.log('✨ Pipeline Verification Successful!');
            process.exit(0);
        } else {
            console.error('💥 Pipeline Verification Failed');
            process.exit(1);
        }

    } catch (error) {
        console.error('Test Error:', error);
        process.exit(1);
    }
}

runTest();
