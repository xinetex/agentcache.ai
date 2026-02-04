/**
 * AgentCache Intelligent Model Router
 * 
 * Dynamically selects the most cost-effective LLM based on:
 * 1. Explicit task type (heartbeat, research, outreach, architecture)
 * 2. Prompt complexity analysis
 * 3. Available budget (via TokenBudget circuit breaker)
 */

import { tokenBudget } from './token-budget.js';

export type ModelTier = 'local' | 'fast' | 'balanced' | 'reasoning';

export type TaskType =
    | 'heartbeat'
    | 'maintenance'
    | 'research'
    | 'outreach'
    | 'coding'
    | 'architecture'
    | 'verification'
    | 'general';

export interface RouteResult {
    tier: ModelTier;
    provider: string;
    model: string;
    reason: string;
    estimatedCostPer1M: number;
    budgetStatus: {
        canProceed: boolean;
        remainingUsd: number;
    };
}

// Configuration for Model Tiers
const TIERS: Record<ModelTier, { provider: string; model: string; cost: number; desc: string }> = {
    local: {
        provider: 'ollama',
        model: 'llama3:latest',
        cost: 0,
        desc: 'Local LLM. Zero cost. Best for heartbeats and maintenance.'
    },
    fast: {
        provider: 'moonshot',
        model: 'kimi-latest',
        cost: 0.15,
        desc: 'High speed, low cost. Best for simple tasks and research.'
    },
    balanced: {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet',
        cost: 3.00,
        desc: 'Best trade-off. Good for coding, writing, and outreach.'
    },
    reasoning: {
        provider: 'openai',
        model: 'o1-preview',
        cost: 15.00,
        desc: 'Maximum intelligence. Best for architecture and complex logic.'
    }
};

// Task Type to Tier Mapping
const TASK_ROUTING: Record<TaskType, ModelTier> = {
    heartbeat: 'local',
    maintenance: 'local',
    research: 'fast',
    outreach: 'balanced',
    coding: 'balanced',
    architecture: 'reasoning',
    verification: 'fast',
    general: 'fast'
};

// Keywords that trigger higher tiers
const REASONING_KEYWORDS = [
    'optimize', 'derive', 'prove', 'architect',
    'analyze deeply', 'refactor', 'design system',
    'finance', 'medical', 'legal', 'strategy'
];

const CODE_INDICATORS = ['function', 'class', 'const', 'import', '```', 'def ', 'struct ', 'async '];

export class ModelRouter {

    /**
     * Route by explicit task type (preferred method)
     */
    routeByTaskType(taskType: TaskType): RouteResult {
        const tier = TASK_ROUTING[taskType] || 'fast';
        const config = TIERS[tier];
        const budgetStatus = tokenBudget.getStatus();

        // Estimate cost for a typical request (2k tokens in, 1k out)
        const estimatedCost = tokenBudget.estimateCost(config.provider, config.model, 2000, 1000);
        const canProceed = tier === 'local' || tokenBudget.canSpend(estimatedCost);

        return {
            tier,
            provider: config.provider,
            model: config.model,
            reason: `Task type "${taskType}" → ${tier} tier (${config.desc})`,
            estimatedCostPer1M: config.cost,
            budgetStatus: {
                canProceed,
                remainingUsd: budgetStatus.remainingUsd
            }
        };
    }

    /**
     * Analyze the prompt and route to the appropriate model tier (fallback method)
     */
    route(prompt: string): RouteResult {
        const text = prompt.toLowerCase();
        const length = prompt.length;
        const budgetStatus = tokenBudget.getStatus();

        // 1. Check for Reasoning Triggers (Tier 4)
        const hasReasoningKeyword = REASONING_KEYWORDS.some(kw => text.includes(kw));
        const hasCode = CODE_INDICATORS.some(kw => text.includes(kw));

        if (hasReasoningKeyword || (hasCode && length > 1000)) {
            const config = TIERS.reasoning;
            const canProceed = tokenBudget.canSpend(config.cost * 0.003); // ~3k tokens
            return {
                tier: 'reasoning',
                provider: config.provider,
                model: config.model,
                reason: hasReasoningKeyword ? 'Detected complex reasoning keywords' : 'Detected complex code generation',
                estimatedCostPer1M: config.cost,
                budgetStatus: { canProceed, remainingUsd: budgetStatus.remainingUsd }
            };
        }

        // 2. Check for Balanced Triggers (Tier 3)
        if (length > 200 || hasCode) {
            const config = TIERS.balanced;
            const canProceed = tokenBudget.canSpend(config.cost * 0.003);
            return {
                tier: 'balanced',
                provider: config.provider,
                model: config.model,
                reason: hasCode ? 'Detected code snippet' : 'Prompt length requires moderate context',
                estimatedCostPer1M: config.cost,
                budgetStatus: { canProceed, remainingUsd: budgetStatus.remainingUsd }
            };
        }

        // 3. Check for heartbeat/simple patterns (Tier 1 - Local)
        if (length < 50 || text.includes('heartbeat') || text.includes('ping') || text.includes('health')) {
            const config = TIERS.local;
            return {
                tier: 'local',
                provider: config.provider,
                model: config.model,
                reason: 'Simple query or system health check → local LLM',
                estimatedCostPer1M: 0,
                budgetStatus: { canProceed: true, remainingUsd: budgetStatus.remainingUsd }
            };
        }

        // 4. Default to Fast (Tier 2)
        const config = TIERS.fast;
        const canProceed = tokenBudget.canSpend(config.cost * 0.002);
        return {
            tier: 'fast',
            provider: config.provider,
            model: config.model,
            reason: 'Standard query, optimized for speed/cost',
            estimatedCostPer1M: config.cost,
            budgetStatus: { canProceed, remainingUsd: budgetStatus.remainingUsd }
        };
    }

    /**
     * Get all available tiers and their configurations
     */
    getTiers(): typeof TIERS {
        return TIERS;
    }

    /**
     * Override a tier's configuration (admin function)
     */
    setTierConfig(tier: ModelTier, provider: string, model: string, cost: number): void {
        TIERS[tier] = { provider, model, cost, desc: TIERS[tier].desc };
        console.log(`[ModelRouter] Tier "${tier}" updated: ${provider}/${model} @ $${cost}/1M`);
    }
}

export const router = new ModelRouter();
