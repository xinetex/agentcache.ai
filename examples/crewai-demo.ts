import { createCrewAgent } from '../src/integrations/crewai.js';

async function run() {
    console.log("🚢 Creating CrewAI Agent with AgentCache...");

    const researcher = createCrewAgent({
        role: "Senior Researcher",
        goal: "Uncover cutting-edge AI developments",
        backstory: "You are an expert analyst with infinite memory.",
        llmConfig: {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet'
        }
    });

    console.log("\n✅ Agent Created Successfully:");
    console.log(`Role: ${researcher.role}`);
    console.log(`LLM Provider: ${researcher.llm.provider}`);
    console.log(`LLM Model: ${researcher.llm.modelName}`);

    // In a real CrewAI setup, you would pass this 'researcher' object to the Crew() constructor.
    console.log("\nReady to be added to a Crew!");
}

run().catch(console.error);
