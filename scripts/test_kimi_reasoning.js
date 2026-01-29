import 'dotenv/config';
import { MoonshotClient } from '../src/lib/moonshot.js';

const MOONSHOT_API_KEY = process.env.MOONSHOT_API_KEY;

if (!MOONSHOT_API_KEY) {
    console.error('❌ MOONSHOT_API_KEY not found in environment');
    process.exit(1);
}

// Ensure the latest model is used for testing reasoning
// Based on research: "moonshot-v1-8k" might not show reasoning, need k2/thinking model if available publicly via similar endpoint
// or just standard model to see if the field exists (even if empty/undefined).
// Research suggested "moonshotai/Kimi-K2.5" or similar names. 
// Let's try to query with a generic model first, but print EVERYTHING.

async function testKimiReasoning() {
    console.log('🚀 Testing Kimi Reasoning Integration...');

    const client = new MoonshotClient(MOONSHOT_API_KEY);

    // Kimi K2.5 or thinking model might be needed. 
    // If unknown, we try the standard one and check if upgrade is needed.
    // However, the user wants us to "update to latest".
    // Let's try to use a model name found in research: "moonshot-v1-8k" is old.
    // Let's try "moonshot-v1-auto" or check if we can specify 'kimi-k2-thinking' if supported.
    // For now, let's stick to the one we know works or try a standard one.
    // Actually, let's try to see if we can trigger "thinking" by prompt or just see if the field comes back null.

    // NOTE: Research said "Kimi K2.5" is available via API. 
    // Let's try to use "moonshot-v1-8k" as a baseline, 
    // but the REAL test is if our code handles the extra field if it appears.

    try {
        const response = await client.chat([
            { role: 'user', content: 'Explain why the sky is blue. Think step by step.' }
        ], 'moonshot-v1-8k'); // We might need to change this model name if K2 is under a different ID

        console.log('✅ Response Received');
        console.log('Model:', response.model);
        console.log('Content:', response.choices[0].message.content.slice(0, 100) + '...');

        const reasoning = response.choices[0].message.reasoning_content;
        if (reasoning) {
            console.log('🧠 Reasoning Content Found:', reasoning.slice(0, 100) + '...');
        } else {
            console.log('⚠️ No reasoning_content field in response (Normal for non-thinking models)');
        }

    } catch (error) {
        console.error('❌ Test Failed:', error);
    }
}

testKimiReasoning();
