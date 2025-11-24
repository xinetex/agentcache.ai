/**
 * AgentCache Intelligent Model Router
 * 
 * Dynamically selects the most cost-effective LLM based on prompt complexity.
 */

export type ModelTier = 'fast' | 'balanced' | 'reasoning';

export interface RouteResult {
    tier: ModelTier;
    model: string;
    reason: string;
    estimatedCost: number; // Cost per 1M tokens (input)
}

// Configuration for Model Tiers
const TIERS = {
    fast: {
        model: 'gpt-4o-mini',
        cost: 0.15,
        desc: 'High speed, low cost. Best for simple tasks.'
    },
    balanced: {
        model: 'claude-3-5-sonnet',
        cost: 3.00,
        desc: 'Best trade-off. Good for coding and writing.'
    },
    reasoning: {
        model: 'o1-preview',
        cost: 15.00,
        desc: 'Maximum intelligence. Best for math, science, and complex logic.'
    }
};

// Keywords that trigger higher tiers
const REASONING_KEYWORDS = [
    'optimize', 'derive', 'prove',
    'analyze', 'architect', 'debug', 'refactor',
    'finance', 'medical', 'legal', 'strategy'
];

const CODE_INDICATORS = ['function', 'class', 'const', 'import', '```', 'def ', 'struct '];

export class ModelRouter {

    /**
     * Analyze the prompt and route to the appropriate model tier.
     */
    route(prompt: string): RouteResult {
        const text = prompt.toLowerCase();
        const length = prompt.length;

        // 1. Check for Reasoning Triggers (Tier 3)
        // If it looks like complex math, heavy coding, or strategic planning
        const hasReasoningKeyword = REASONING_KEYWORDS.some(kw => text.includes(kw));
        const hasCode = CODE_INDICATORS.some(kw => text.includes(kw));

        if (hasReasoningKeyword || (hasCode && length > 500)) {
            return {
                tier: 'reasoning',
                model: TIERS.reasoning.model,
                reason: hasReasoningKeyword ? 'Detected complex reasoning keywords' : 'Detected complex code generation',
                estimatedCost: TIERS.reasoning.cost
            };
        }

        // 2. Check for Balanced Triggers (Tier 2)
        // Standard coding, writing, summarization
        if (length > 100 || hasCode) {
            return {
                tier: 'balanced',
                model: TIERS.balanced.model,
                reason: hasCode ? 'Detected code snippet' : 'Prompt length requires moderate context',
                estimatedCost: TIERS.balanced.cost
            };
        }

        // 3. Default to Fast (Tier 1)
        // Simple greetings, fact lookups, short questions
        return {
            tier: 'fast',
            model: TIERS.fast.model,
            reason: 'Simple query, optimized for speed/cost',
            estimatedCost: TIERS.fast.cost
        };
    }
}

export const router = new ModelRouter();
