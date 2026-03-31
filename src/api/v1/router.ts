/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
import { Hono } from 'hono';
import { authenticateApiKey } from '../../middleware/auth.js';
import { TrustBrokerService } from '../../services/trust-broker.js';
import { billing } from '../../lib/payment/billing.js';
import { ClaudeMdService } from '../../lib/claudemd.js';

type Variables = {
    tier: string;
    usage: any;
    tierFeatures: any;
    apiKey: string;
};

const v1 = new Hono<{ Variables: Variables }>();

// Initialize Services
const broker = new TrustBrokerService();

// Apply Auth Middleware manually in each route, or create a Hono wrapper
const authMiddleware = async (c: any, next: any) => {
    const authError = await authenticateApiKey(c);
    if (authError) return authError;
    await next();
};

v1.use('*', authMiddleware);

/**
 * POST /v1/truth/verify
 * Public endpoint for agents to verify claims.
 * Cost: 10 Credits per call.
 */
v1.post('/truth/verify', async (c) => {
    const body = await c.req.json();
    const { claim } = body;

    if (!claim || typeof claim !== 'string') {
        return c.json({ error: 'Missing or invalid "claim" field' }, 400);
    }

    // Metering (Mock Subscription Item ID for now)
    // In production, we'd lookup the user's subscription item ID from DB
    await billing.recordUsage('si_mock_metered_usage', 10);

    try {
        const result = await broker.verifyClaim(claim);

        return c.json({
            meta: {
                credits_deducted: 10,
                model: 'system-2-reasoner'
            },
            data: result
        });

    } catch (e) {
        console.error('[API v1] Verify failed:', e);
        return c.json({ error: 'Internal verification error' }, 500);
    }
});

/**
 * GET /v1/status
 * Check API health and auth status
 */
v1.get('/status', (c) => {
    const tier = c.get('tier');
    const usage = c.get('usage');
    return c.json({
        system: 'online',
        auth: {
            tier,
            quota_remaining: usage?.remaining
        }
    });
});

import { docsRouter } from './docs.js';
v1.route('/docs', docsRouter);

/**
 * POST /v1/chat/completions
 * OpenAI-compatible universal proxy endpoint for Hermes Agent and others.
 * Routes through Semantic Cache, bills x402 automatically, and proxies to upstream models.
 */
v1.post('/chat/completions', async (c) => {
    const apiKey = c.get('apiKey');
    try {
        const body = await c.req.json();
        const { model, messages, temperature = 0.7, stream = false } = body;

        if (stream) {
            return c.json({ error: { message: 'Streaming is not currently supported in the MVP caching layer.' } }, 400);
        }

        let provider = 'openai';
        let actualModel = model || 'gpt-4o';
        if (model && model.includes('/')) {
            const parts = model.split('/');
            provider = parts[0];
            actualModel = parts.slice(1).join('/');
        }

        const { SemanticCacheService } = await import('../../services/SemanticCacheService.js');
        const semanticCacheService = new SemanticCacheService();

        const cacheParams = {
            provider,
            model: actualModel,
            messages,
            temperature,
            sector: c.req.header('X-AgentCache-Sector') || 'general',
            sessionId: c.req.header('X-Session-Id') || `external-${apiKey}`
        };

        const cacheCheck = await semanticCacheService.check(cacheParams);

        if (cacheCheck.hit) {
            return c.json({
                id: 'chatcmpl-ac-' + cacheCheck.key,
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: model,
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: cacheCheck.response
                    },
                    logprobs: null,
                    finish_reason: 'stop'
                }],
                usage: {
                    prompt_tokens: 0,
                    completion_tokens: 0,
                    total_tokens: 0
                },
                system_fingerprint: 'fp_agentcache_' + cacheCheck.reason
            });
        }

        // Cache Miss -> call LLM Factory
        const { LLMFactory } = await import('../../lib/llm/factory.js');
        const llm = LLMFactory.createProvider(provider as any);

        // Phase 40: "Moonshot" Project Awareness (CLAUDE.md)
        // Inject tribal knowledge stored in CLAUDE.md into the assistant's context.
        const conventions = await ClaudeMdService.getSystemPromptSegment(cacheParams.sessionId);
        
        const llmMessages = messages.map((m: any) => ({
             role: m.role,
             content: m.content
        }));

        if (conventions) {
            // Find existing system message or prepend new one
            const systemIdx = llmMessages.findIndex((m: any) => m.role === 'system');
            if (systemIdx >= 0) {
                llmMessages[systemIdx].content += conventions;
            } else {
                llmMessages.unshift({ role: 'system', content: `Environment Context:\n${conventions}` });
            }
        }

        const result = await llm.chat(llmMessages, { model: actualModel, temperature });

        await semanticCacheService.set({
            ...cacheParams,
            response: result.content,
            ttl: 604800
        });

        return c.json({
            id: 'chatcmpl-' + Date.now(),
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: model,
            choices: [{
                index: 0,
                message: {
                    role: 'assistant',
                    content: result.content
                },
                logprobs: null,
                finish_reason: 'stop'
            }],
            usage: result.usage || {
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0
            }
        });
    } catch (e: any) {
        console.error('[OpenAI Proxy] Error:', e);
        return c.json({ error: { message: e.message } }, 500);
    }
});

// --- Savings API ---
import { savingsTracker } from '../../lib/llm/savings-tracker.js';
import { tokenBudget } from '../../lib/llm/token-budget.js';

/**
 * GET /v1/savings
 * Returns real-time cost savings data — the core metric for AgentCache
 */
v1.get('/savings', async (c) => {
    const apiKey = c.get('apiKey');
    const date = c.req.query('date'); // Optional: ?date=2026-02-06

    const [daily, userSavings, monthly, budget] = await Promise.all([
        savingsTracker.getDailySavings(date),
        savingsTracker.getUserSavings(apiKey, date),
        savingsTracker.getMonthlySavings(),
        tokenBudget.getPersistedDailySpend(),
    ]);

    return c.json({
        savings: {
            today: {
                totalSavedUsd: daily.totalSavedUsd,
                yourSavedUsd: userSavings,
                cacheHits: daily.cacheHits,
                avgSavingPerHit: daily.avgSavingPerHit,
                breakdown: daily.breakdown,
            },
            month: {
                totalSavedUsd: monthly,
            },
        },
        spend: {
            todayUsd: budget,
            dailyLimitUsd: parseFloat(process.env.MAX_DAILY_SPEND_USD || '10'),
        },
        message: 'Real-time savings from cache hits and intelligent model routing.',
    });
});

export const v1Router = v1;
export default v1;
