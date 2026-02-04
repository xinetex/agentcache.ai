/**
 * Token Budget API
 * 
 * Provides real-time token spend data and budget status for Mission Control.
 */

import { Hono } from 'hono';
import { tokenBudget } from '../lib/llm/token-budget.js';
import { router } from '../lib/llm/router.js';

const budgetRouter = new Hono();

/**
 * GET /api/budget/status
 * Returns current budget status and spend breakdown
 */
budgetRouter.get('/status', async (c) => {
    const status = tokenBudget.getStatus();
    const byProvider = tokenBudget.getSpendByProvider();
    const byTask = tokenBudget.getSpendByTask();
    const recentSpend = tokenBudget.getRecentSpend(20);

    return c.json({
        status: {
            dailySpendUsd: status.dailySpendUsd,
            dailyLimitUsd: status.dailyLimitUsd,
            remainingUsd: status.remainingUsd,
            isBlocked: status.isBlocked,
            callCount: status.callCount,
            lastReset: status.lastReset.toISOString()
        },
        breakdown: {
            byProvider,
            byTask
        },
        recentCalls: recentSpend.map(s => ({
            timestamp: s.timestamp.toISOString(),
            provider: s.provider,
            model: s.model,
            tokens: s.inputTokens + s.outputTokens,
            costUsd: s.costUsd,
            taskType: s.taskType
        })),
        tiers: router.getTiers()
    });
});

/**
 * POST /api/budget/limit
 * Update the daily spend limit (admin only)
 */
budgetRouter.post('/limit', async (c) => {
    const body = await c.req.json();
    const newLimit = parseFloat(body.limitUsd);

    if (isNaN(newLimit) || newLimit < 0) {
        return c.json({ error: 'Invalid limit value' }, 400);
    }

    tokenBudget.setDailyLimit(newLimit);

    return c.json({
        success: true,
        newLimit: newLimit,
        status: tokenBudget.getStatus()
    });
});

/**
 * POST /api/budget/route
 * Test the model router with a given prompt or task type
 */
budgetRouter.post('/route', async (c) => {
    const body = await c.req.json();

    if (body.taskType) {
        const result = router.routeByTaskType(body.taskType);
        return c.json({ method: 'taskType', result });
    }

    if (body.prompt) {
        const result = router.route(body.prompt);
        return c.json({ method: 'prompt', result });
    }

    return c.json({ error: 'Provide either taskType or prompt' }, 400);
});

export default budgetRouter;
