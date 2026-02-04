/**
 * Goal-Oriented Action Planning (GOAP) System
 * 
 * A native GOAP planner for AgentCache that:
 * 1. Takes a high-level goal and decomposes it into actions
 * 2. Considers cost constraints via TokenBudget
 * 3. Selects optimal model tiers for each action
 * 4. Executes the plan with circuit-breaker protection
 * 
 * Inspired by game AI GOAP systems, adapted for LLM orchestration.
 */

import { tokenBudget, TokenSpend } from '../lib/llm/token-budget.js';
import { router, TaskType, RouteResult } from '../lib/llm/router.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * World State: A set of boolean conditions
 */
export type WorldState = Record<string, boolean>;

/**
 * An action the agent can perform
 */
export interface GOAPAction {
    name: string;
    taskType: TaskType;
    preconditions: WorldState;
    effects: WorldState;
    estimatedCostUsd: number;
    estimatedTokens: number;
    execute: (context: PlanContext) => Promise<ActionResult>;
}

/**
 * Result of executing an action
 */
export interface ActionResult {
    success: boolean;
    newState?: Partial<WorldState>;
    output?: any;
    error?: string;
    actualCostUsd?: number;
}

/**
 * A plan is a sequence of actions
 */
export interface GOAPPlan {
    goal: string;
    actions: GOAPAction[];
    totalEstimatedCostUsd: number;
    totalEstimatedTokens: number;
    canAfford: boolean;
}

/**
 * Context passed to action execution
 */
export interface PlanContext {
    goal: string;
    worldState: WorldState;
    accumulatedOutput: any[];
    budgetRemaining: number;
}

// ============================================================================
// GOAP PLANNER
// ============================================================================

export class GOAPPlanner {
    private actions: GOAPAction[] = [];

    /**
     * Register an action the planner can use
     */
    registerAction(action: GOAPAction): void {
        this.actions.push(action);
        console.log(`[GOAP] Registered action: ${action.name}`);
    }

    /**
     * Plan a sequence of actions to achieve the goal
     * Uses backward chaining: start from goal, work back to current state
     */
    plan(currentState: WorldState, goalState: WorldState): GOAPPlan | null {
        const goalKey = Object.keys(goalState).join(',');
        console.log(`[GOAP] Planning for goal: ${goalKey}`);

        // Simple A* search through action space
        const plan: GOAPAction[] = [];
        let workingState = { ...goalState };
        let totalCost = 0;
        let totalTokens = 0;

        // Find actions that achieve unmet goals (backward chaining)
        const unmetGoals = Object.entries(goalState).filter(
            ([key, value]) => currentState[key] !== value
        );

        for (const [goalKey] of unmetGoals) {
            // Find action that achieves this goal
            const action = this.actions.find(a => a.effects[goalKey] === true);
            if (action) {
                // Check if preconditions are met
                const preconditionsMet = Object.entries(action.preconditions).every(
                    ([key, value]) => currentState[key] === value || goalState[key] === value
                );

                if (preconditionsMet) {
                    plan.push(action);
                    totalCost += action.estimatedCostUsd;
                    totalTokens += action.estimatedTokens;
                }
            }
        }

        if (plan.length === 0) {
            console.log('[GOAP] No valid plan found.');
            return null;
        }

        // Check budget
        const budgetStatus = tokenBudget.getStatus();
        const canAfford = totalCost <= budgetStatus.remainingUsd;

        console.log(`[GOAP] Plan found: ${plan.map(a => a.name).join(' → ')}`);
        console.log(`[GOAP] Estimated cost: $${totalCost.toFixed(4)} | Budget: $${budgetStatus.remainingUsd.toFixed(2)} | Can Afford: ${canAfford}`);

        return {
            goal: goalKey,
            actions: plan,
            totalEstimatedCostUsd: totalCost,
            totalEstimatedTokens: totalTokens,
            canAfford
        };
    }

    /**
     * Execute a plan
     */
    async execute(plan: GOAPPlan, initialState: WorldState): Promise<{
        success: boolean;
        finalState: WorldState;
        outputs: any[];
        actualCostUsd: number;
    }> {
        if (!plan.canAfford) {
            console.warn('[GOAP] Cannot execute plan: insufficient budget.');
            return {
                success: false,
                finalState: initialState,
                outputs: [],
                actualCostUsd: 0
            };
        }

        let currentState = { ...initialState };
        const outputs: any[] = [];
        let actualCost = 0;

        for (const action of plan.actions) {
            console.log(`[GOAP] Executing: ${action.name}`);

            // Check circuit breaker
            const budgetStatus = tokenBudget.getStatus();
            if (budgetStatus.isBlocked) {
                console.error('[GOAP] Circuit breaker OPEN. Halting execution.');
                return {
                    success: false,
                    finalState: currentState,
                    outputs,
                    actualCostUsd: actualCost
                };
            }

            // Get optimal model for this action
            const route = router.routeByTaskType(action.taskType);
            console.log(`[GOAP] Routed to: ${route.provider}/${route.model} (${route.tier})`);

            // Execute action
            const context: PlanContext = {
                goal: plan.goal,
                worldState: currentState,
                accumulatedOutput: outputs,
                budgetRemaining: budgetStatus.remainingUsd
            };

            try {
                const result = await action.execute(context);

                if (result.success) {
                    // Update state with effects
                    currentState = { ...currentState, ...action.effects, ...result.newState };
                    if (result.output) outputs.push(result.output);
                    actualCost += result.actualCostUsd || action.estimatedCostUsd;

                    // Record spend
                    const spend: TokenSpend = {
                        timestamp: new Date(),
                        provider: route.provider,
                        model: route.model,
                        inputTokens: action.estimatedTokens * 0.7,
                        outputTokens: action.estimatedTokens * 0.3,
                        costUsd: result.actualCostUsd || action.estimatedCostUsd,
                        taskType: action.taskType
                    };
                    tokenBudget.recordSpend(spend);

                } else {
                    console.error(`[GOAP] Action failed: ${action.name} - ${result.error}`);
                    return {
                        success: false,
                        finalState: currentState,
                        outputs,
                        actualCostUsd: actualCost
                    };
                }
            } catch (err: any) {
                console.error(`[GOAP] Action threw error: ${err.message}`);
                return {
                    success: false,
                    finalState: currentState,
                    outputs,
                    actualCostUsd: actualCost
                };
            }
        }

        console.log(`[GOAP] Plan executed successfully. Total cost: $${actualCost.toFixed(4)}`);
        return {
            success: true,
            finalState: currentState,
            outputs,
            actualCostUsd: actualCost
        };
    }
}

// ============================================================================
// SINGLETON & BUILT-IN ACTIONS
// ============================================================================

export const goap = new GOAPPlanner();

// Register common actions
goap.registerAction({
    name: 'heartbeat',
    taskType: 'heartbeat',
    preconditions: {},
    effects: { systemChecked: true },
    estimatedCostUsd: 0,
    estimatedTokens: 100,
    execute: async () => ({ success: true, output: 'OK' })
});

goap.registerAction({
    name: 'research_topic',
    taskType: 'research',
    preconditions: { topicDefined: true },
    effects: { researchComplete: true },
    estimatedCostUsd: 0.002,
    estimatedTokens: 2000,
    execute: async (ctx) => {
        // Placeholder - would call Kimi/Perplexity here
        return { success: true, output: { research: 'placeholder' } };
    }
});

goap.registerAction({
    name: 'draft_outreach',
    taskType: 'outreach',
    preconditions: { researchComplete: true },
    effects: { outreachDrafted: true },
    estimatedCostUsd: 0.01,
    estimatedTokens: 3000,
    execute: async (ctx) => {
        // Placeholder - would call Claude Sonnet here
        return { success: true, output: { email: 'placeholder' } };
    }
});

goap.registerAction({
    name: 'verify_claim',
    taskType: 'verification',
    preconditions: { claimDefined: true },
    effects: { claimVerified: true },
    estimatedCostUsd: 0.001,
    estimatedTokens: 500,
    execute: async (ctx) => {
        // Would call the Trust Broker
        return { success: true, output: { verified: true } };
    }
});

goap.registerAction({
    name: 'architect_solution',
    taskType: 'architecture',
    preconditions: { requirementsGathered: true },
    effects: { architectureComplete: true },
    estimatedCostUsd: 0.05,
    estimatedTokens: 5000,
    execute: async (ctx) => {
        // Would call o1-preview for complex reasoning
        return { success: true, output: { architecture: 'placeholder' } };
    }
});
