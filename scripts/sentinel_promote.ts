import { moltbook } from '../src/lib/moltbook.js';
import { LLMFactory } from '../src/lib/llm/factory.js';
import 'dotenv/config';

async function promote() {
    console.log('🛡️  Sentinel Protocol Initiated: Promotion Sequence');

    // 1. Check for Capabilities
    const apiKey = process.env.MOLTBOOK_API_KEY;
    if (!apiKey) {
        console.warn('⚠️  No MOLTBOOK_API_KEY found. Running in DRY RUN mode (Generation only).');
    }

    // 2. Generate Content (High Alpha / Crypto Twitter style)
    console.log('🧠 Generating viral content...');
    const llm = LLMFactory.createProvider('openai'); // Use OpenAI for creative copy
    const prompt = `
    Write a short, high-energy, "crypto-native" tweet/post (under 280 chars) announcing a new feature for "AgentCache".
    
    Feature: "The Trust Broker"
    What it does: An AI Truth Engine (System 2 Reasoning) that verifies agent claims instantly.
    Key benefit: "Don't trust, verify. Automatically."
    Tone: Cyberpunk, influential, authoritative.
    Call to Action: Check the Public API.
    
    Output ONLY the post text.
    `;

    let postContent = "";
    try {
        const response = await llm.chat([
            { role: 'user', content: prompt }
        ], { model: 'gpt-4o', temperature: 0.8 });
        postContent = response.content.replace(/"/g, '').trim();
    } catch (e) {
        console.error('Generation failed:', e);
        postContent = "🚀 AgentCache upgrade: Trust Broker is live. Verify everything. #System2 #AI";
    }

    console.log(`\n📝 Generated Post:\n"${postContent}"\n`);

    // 3. Post to Network
    if (apiKey) {
        try {
            console.log('📡 Broadcasting to Moltbook Network...');
            // Post to the 'main' feed or a specific submolt if known
            // For now, we assume the agent's default feed
            const result = await moltbook.post('agentcache-community', 'Trust Broker Launch', postContent);
            console.log(`✅ Posted successfully! ID: ${result.id}`);
        } catch (e) {
            console.error('❌ Posting failed:', e.message);
        }
    } else {
        console.log('🛑 Dry Run Complete. Add MOLTBOOK_API_KEY to deploy.');
    }
}

promote().catch(console.error);
