import 'dotenv/config';

const MOONSHOT_API_KEY = process.env.MOONSHOT_API_KEY;

if (!MOONSHOT_API_KEY) {
    console.error('❌ MOONSHOT_API_KEY not found in environment');
    process.exit(1);
}

console.log(`🔑 Found API Key: ${MOONSHOT_API_KEY.slice(0, 8)}...`);

async function testMoonshot() {
    // CORRECT ENDPOINT from User Docs: https://api.moonshot.ai/v1
    const ENDPOINT = 'https://api.moonshot.ai/v1/chat/completions';
    const MODEL = 'moonshot-v1-8k';

    console.log(`🚀 Testing Moonshot AI connection...`);
    console.log(`📍 Endpoint: ${ENDPOINT}`);
    console.log(`🤖 Model: ${MODEL}`);

    try {
        const response = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${MOONSHOT_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    { role: 'system', content: 'You are a helpful assistant.' },
                    { role: 'user', content: 'Say "Hello, AgentCache!"' }
                ]
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`API Error: ${response.status} ${response.statusText} - ${error}`);
        }

        const data = await response.json();
        console.log('✅ Success!');
        console.log('📝 Response:', data.choices[0].message.content);

    } catch (error) {
        console.error('❌ Test Failed:', error.message);
        process.exit(1);
    }
}

testMoonshot();
