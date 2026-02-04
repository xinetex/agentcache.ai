/**
 * GOAP API
 * 
 * RESTful interface for the Goal-Oriented Action Planning system.
 * Allows agents and external systems to submit goals and execute plans.
 */

import { Hono } from 'hono';
import { goap, GOAPAction, WorldState } from '../lib/goap.js';
import { tokenBudget } from '../lib/llm/token-budget.js';

const goapRouter = new Hono();

/**
 * POST /api/goap/plan
 * Generate a plan for a given goal without executing
 */
goapRouter.post('/plan', async (c) => {
    const body = await c.req.json();
    const currentState: WorldState = body.currentState || {};
    const goalState: WorldState = body.goalState || {};

    if (Object.keys(goalState).length === 0) {
        return c.json({ error: 'goalState is required' }, 400);
    }

    const plan = goap.plan(currentState, goalState);

    if (!plan) {
        return c.json({
            success: false,
            error: 'No valid plan found for the given goal.',
            currentState,
            goalState
        }, 404);
    }

    return c.json({
        success: true,
        plan: {
            goal: plan.goal,
            actions: plan.actions.map(a => ({
                name: a.name,
                taskType: a.taskType,
                estimatedCostUsd: a.estimatedCostUsd,
                estimatedTokens: a.estimatedTokens
            })),
            totalEstimatedCostUsd: plan.totalEstimatedCostUsd,
            totalEstimatedTokens: plan.totalEstimatedTokens,
            canAfford: plan.canAfford
        },
        budget: tokenBudget.getStatus()
    });
});

/**
 * POST /api/goap/execute
 * Plan and execute in one call
 */
goapRouter.post('/execute', async (c) => {
    const body = await c.req.json();
    const currentState: WorldState = body.currentState || {};
    const goalState: WorldState = body.goalState || {};

    if (Object.keys(goalState).length === 0) {
        return c.json({ error: 'goalState is required' }, 400);
    }

    // Check circuit breaker first
    const budgetStatus = tokenBudget.getStatus();
    if (budgetStatus.isBlocked) {
        return c.json({
            success: false,
            error: 'Circuit breaker is OPEN. Budget exhausted.',
            budget: budgetStatus
        }, 503);
    }

    // Generate plan
    const plan = goap.plan(currentState, goalState);

    if (!plan) {
        return c.json({
            success: false,
            error: 'No valid plan found.',
            currentState,
            goalState
        }, 404);
    }

    if (!plan.canAfford) {
        return c.json({
            success: false,
            error: 'Insufficient budget for this plan.',
            plan: {
                goal: plan.goal,
                totalEstimatedCostUsd: plan.totalEstimatedCostUsd,
                actions: plan.actions.map(a => a.name)
            },
            budget: budgetStatus
        }, 402);
    }

    // Execute plan
    const result = await goap.execute(plan, currentState);

    return c.json({
        success: result.success,
        finalState: result.finalState,
        outputs: result.outputs,
        actualCostUsd: result.actualCostUsd,
        budget: tokenBudget.getStatus()
    });
});

/**
 * GET /api/goap/actions
 * List all registered actions
 */
goapRouter.get('/actions', async (c) => {
    // Access private actions via reflection (not ideal but works for demo)
    // In production, expose a getActions() method on GOAPPlanner
    return c.json({
        message: 'Use POST /api/goap/plan to see available actions for a goal.',
        defaultActions: [
            'heartbeat',
            'research_topic',
            'draft_outreach',
            'verify_claim',
            'architect_solution'
        ]
    });
});

export default goapRouter;
