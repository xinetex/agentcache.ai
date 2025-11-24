import { LLMFactory } from '../src/lib/llm/factory.js';

// Mock environment variables for testing
process.env.OPENAI_API_KEY = 'mock-openai-key';
process.env.ANTHROPIC_API_KEY = 'mock-anthropic-key';
process.env.GEMINI_API_KEY = 'mock-gemini-key';
process.env.MOONSHOT_API_KEY = 'mock-moonshot-key';

// Mock fetch globally
global.fetch = async (url, options) => {
    console.log(`📡 Fetching: ${url}`);

    if (url.includes('api.openai.com')) {
        return {
            ok: true,
            json: async () => ({
                choices: [{ message: { content: 'Hello from OpenAI' } }],
                usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
                model: 'gpt-4o'
            })
        };
    }

    if (url.includes('api.anthropic.com')) {
        return {
            ok: true,
            json: async () => ({
                content: [{ text: 'Hello from Claude' }],
                usage: { input_tokens: 10, output_tokens: 5 },
                model: 'claude-3-5-sonnet'
            })
        };
    }

    if (url.includes('generativelanguage.googleapis.com')) {
        return {
            ok: true,
            json: async () => ({
                candidates: [{ content: { parts: [{ text: 'Hello from Gemini' }] } }],
                usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 }
            })
        };
    }

    if (url.includes('api.moonshot.ai')) {
        return {
            ok: true,
            json: async () => ({
                choices: [{ message: { content: 'Hello from Moonshot' } }],
                usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15, reasoning_tokens: 0 },
                model: 'moonshot-v1-8k'
            })
        };
    }

    return { ok: false, status: 404, statusText: 'Not Found' };
};

async function testProvider(name) {
    console.log(`\n🧪 Testing ${name}...`);
    try {
        const provider = LLMFactory.createProvider(name);
        const response = await provider.chat([{ role: 'user', content: 'Hello' }]);
        console.log(`✅ ${name} Response:`, response.content);
        console.log(`   Provider: ${response.provider}, Model: ${response.model}`);
        return true;
    } catch (error) {
        console.error(`❌ ${name} Failed:`, error);
        return false;
    }
}

async function run() {
    const providers = ['openai', 'anthropic', 'gemini', 'moonshot'];
    let allPassed = true;

    for (const p of providers) {
        const passed = await testProvider(p);
        if (!passed) allPassed = false;
    }

    if (allPassed) {
        console.log('\n✨ All providers verified successfully!');
        process.exit(0);
    } else {
        console.error('\n💥 Some providers failed verification.');
        process.exit(1);
    }
}

run();
