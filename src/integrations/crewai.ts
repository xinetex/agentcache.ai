import { ChatAgentCache, AgentCacheInput } from './langchain.js';

// CrewAI types are not strictly typed in this snippet, but we return a config object
// that CrewAI agents expect (usually an 'llm' property).

export function createCrewAgent(config: {
    role: string;
    goal: string;
    backstory: string;
    llmConfig?: AgentCacheInput;
}) {
    const llm = new ChatAgentCache(config.llmConfig || {});

    return {
        role: config.role,
        goal: config.goal,
        backstory: config.backstory,
        llm: llm,
        verbose: true,
        allow_delegation: false, // Default for now
    };
}
