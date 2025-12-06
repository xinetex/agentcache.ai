export type CognitiveRoute = 'system_1' | 'system_2';

export class CognitiveRouter {

    /**
     * The Gating Network: Decides which cognitive system to engage.
     * @param query The user's input
     */
    async route(query: string): Promise<CognitiveRoute> {
        const complexity = await this.classifyComplexity(query);

        // Threshold: > 0.6 triggers Deep Reasoning
        if (complexity > 0.6) {
            return 'system_2';
        }
        return 'system_1';
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
            'why', 'how might', 'strategy', 'complex', 'reason'
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
