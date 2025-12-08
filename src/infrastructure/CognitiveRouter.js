
/**
 * Cognitive Router (The Traffic Controller)
 * 
 * Determines whether a query should be handled by:
 * 1. Fast Cache (System 1) - Low latency, exact match or simple retrieval.
 * 2. High-Performance Model (System 2) - Complex reasoning, multi-step logic.
 */

export class CognitiveRouter {
    constructor() {
        this.complexityThreshold = 0.7;
    }

    /**
     * Analyze the prompt and route it.
     * @param {string} prompt 
     * @returns {string} 'cache' | 'fast_model' | 'system_2'
     */
    async route(prompt) {
        if (!prompt) return 'cache';

        const signals = this.analyzeSignals(prompt);

        if (signals.complexity > 0.8 || signals.reasoningKeywords) {
            return 'system_2';
        }

        if (signals.length > 200 && signals.complexity > 0.4) {
            return 'fast_model'; // e.g. GPT-3.5 / Haiku
        }

        return 'cache'; // Default to checking cache first
    }

    /**
     * Heuristic analysis of the prompt
     */
    analyzeSignals(prompt) {
        const text = prompt.toLowerCase();

        const reasoningIndicators = [
            'why', 'explain', 'compare', 'analyze', 'evaluate', 'solve',
            'difference between', 'pros and cons', 'step by step', 'chain of thought'
        ];

        const hasReasoning = reasoningIndicators.some(w => text.includes(w));
        const lengthScore = Math.min(1, prompt.length / 1000); // Normalize length

        // simple complexity score
        let score = 0.2; // Base
        if (hasReasoning) score += 0.5;
        score += (lengthScore * 0.3);

        return {
            complexity: Math.min(1, score),
            reasoningKeywords: hasReasoning,
            length: prompt.length
        };
    }
}
