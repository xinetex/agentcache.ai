
import { MetaAgent } from '../lib/meta/MetaAgent.js';
import { HierarchicalMemory } from '../lib/memory/HierarchicalMemory.js';

export type CognitiveRoute = 'system_1' | 'system_2';

export class CognitiveRouter {
    private metaAgent: MetaAgent;

    constructor() {
        // Initialize the Evolutionary Supervisor
        this.metaAgent = new MetaAgent();
    }

    /**
     * The Gating Network: Decides which cognitive system to engage.
     * @param query The user's input
     */
    async route(query: string, sessionId?: string): Promise<CognitiveRoute> {
        const complexity = await this.classifyComplexity(query);

        // Threshold: > 0.6 triggers Deep Reasoning (System 2)
        if (complexity > 0.6) {
            console.log(`[CognitiveRouter] System 2 Engaged (Complexity: ${complexity})`);

            // If Session ID provided, we could instantiate Memory here, 
            // but Router just routes. The Agent implementing this route will use Memory.

            // Trigger Meta-Agent optimization step purely as a background side-effect?
            // "Every hard problem makes us smarter" - Tuned by the query itself?
            // For now, we just route.
            return 'system_2';
        }
        return 'system_1';
    }

    /**
     * Access point for the Supervisor to optimize a specific agent configuration
     * This exposes the Confucius "Meta-Agent" capabilities to the rest of the system.
     */
    public getSupervisor(): MetaAgent {
        return this.metaAgent;
    }

    /**
     * Analyzes the "Entropy" or "Complexity" of a query.
     * Returns a score 0.0 (Simple) to 1.0 (Complex).
     */
    private async classifyComplexity(query: string): Promise<number> {
        // 1. Trivial Check (Greetings, short commands)
        const lower = query.toLowerCase().trim();
        if (['hello', 'hi', 'ping', 'status'].includes(lower)) return 0.1;

        // 2. Heuristics
        let score = 0.3; // Base score

        // Length heuristic (Longer = usually more complex)
        if (query.length > 50) score += 0.2;
        if (query.length > 200) score += 0.2;

        // Semantic triggers for Deep Reasoning
        const complexityTriggers = [
            'design', 'architect', 'explain', 'compare', 'solve', 'analyze',
            'why', 'how might', 'strategy', 'complex', 'reason', 'optimize', 'evolve'
        ];

        for (const trigger of complexityTriggers) {
            if (lower.includes(trigger)) {
                score += 0.4; // Boosted from 0.3
                break; // One trigger is enough to boost
            }
        }

        // Cap at 1.0
        return Math.min(score, 1.0);
    }
}

