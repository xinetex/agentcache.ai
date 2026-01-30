import 'dotenv/config';
import { GrokProvider } from '../src/lib/llm/providers/grok.js';

async function testGrok() {
    console.log('Testing Grok integration...');

    if (!process.env.AI_GATEWAY_API_KEY) {
        console.error('Error: AI_GATEWAY_API_KEY is not set.');
        process.exit(1);
    }

    const provider = new GrokProvider();

    try {
        const response = await provider.chat([
            { role: 'user', content: 'Hello, are you Grok?' }
        ]);

        console.log('Response received:');
        console.log('Content:', response.content);
        console.log('Model:', response.model);
        console.log('Usage:', response.usage);
        console.log('Provider:', response.provider);

    } catch (error) {
        console.error('Error testing Grok:', error);
    }
}

testGrok();
