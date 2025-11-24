import { ChatAgentCache } from '../src/integrations/langchain.js';
import { HumanMessage } from '@langchain/core/messages';

// Mock fetch for the example if running standalone without a server
if (!global.fetch) {
    global.fetch = async () => ({
        ok: true,
        json: async () => ({
            message: "I am a cached agent response!",
            cached: true,
            latency: 50,
            metrics: { actualReasoningTokens: 100 }
        })
    }) as any;
}

async function run() {
    console.log("🚀 Initializing ChatAgentCache...");

    const model = new ChatAgentCache({
        provider: 'openai',
        model: 'gpt-4o',
        apiKey: 'mock-key'
    });

    console.log("💬 Sending message...");
    const response = await model.invoke([new HumanMessage("Hello, AgentCache!")]);

    console.log("\n✅ Response received:");
    console.log(response.content);
    console.log("\n📊 Generation Info (Cache Stats):");
    console.log(response.response_metadata);
}

run().catch(console.error);
