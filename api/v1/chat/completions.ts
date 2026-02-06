
import { LidarCacheService } from '../../../src/services/LidarCacheService.js';
import { LLMFactory } from '../../../src/lib/llm/factory.js';
import { LogService } from '../../../src/services/LogService.js';
import { router as modelRouter } from '../../../src/lib/llm/router.js';
import { tokenBudget } from '../../../src/lib/llm/token-budget.js';
import { savingsTracker } from '../../../src/lib/llm/savings-tracker.js';

// Semantic cache similarity threshold (0.0 = exact match, 1.0 = anything matches)
// 0.92 is the standard for production semantic caching — tight enough to avoid false
// positives but loose enough to catch rephrased versions of the same question.
const SEMANTIC_THRESHOLD = parseFloat(process.env.SEMANTIC_CACHE_THRESHOLD || '0.92');

export default async function handler(req, res) {
    // 1. Method Check
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { messages, model = 'gpt-4o', temperature = 0.7, stream = false } = req.body;
    const apiKey = req.headers['authorization'];

    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Invalid messages format' });
    }

    const lastMessage = messages[messages.length - 1].content;
    const requestStart = Date.now();

    try {
        // --- LAYER 0: COMPLIANCE (PII Redaction) ---
        const piiPattern = /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/;
        if (piiPattern.test(lastMessage)) {
            LogService.log('gateway', 'warn', 'PII Detected. Request blocked by Compliance Policy.');
            return res.status(400).json({
                error: {
                    message: "Request blocked: PII detected in prompt. Please redact sensitive data.",
                    type: "compliance_violation",
                    code: "PII_DETECTED"
                }
            });
        }

        // --- LAYER 1: GATEWAY CACHE (Semantic) ---
        if (messages.length > 0) {
            const cachedResponse = await LidarCacheService.getSemantic(lastMessage, SEMANTIC_THRESHOLD);
            if (cachedResponse) {
                const latency = Date.now() - requestStart;

                // Calculate savings: this cache hit avoided an LLM call
                const estimatedTokens = Math.ceil(lastMessage.length / 4); // ~4 chars per token
                const estimatedSaved = tokenBudget.estimateCost('openai', model, estimatedTokens, estimatedTokens);
                await savingsTracker.recordSaving(apiKey || 'anonymous', estimatedSaved, 'semantic_cache', model);

                const response = {
                    id: `chatcmpl-cache-${Date.now()}`,
                    object: 'chat.completion',
                    created: Date.now(),
                    model: 'agentcache-semantic-v1',
                    choices: [{
                        index: 0,
                        message: { role: 'assistant', content: cachedResponse },
                        finish_reason: 'stop'
                    }],
                    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
                };

                res.setHeader('X-Cache', 'HIT');
                res.setHeader('X-Cache-Type', 'semantic');
                res.setHeader('X-Cache-Latency', String(latency));
                res.setHeader('X-Cost-Saved', estimatedSaved.toFixed(6));

                LogService.log('gateway', 'success', `Cache HIT for: ${lastMessage.substring(0, 30)}...`, { latency, saved: estimatedSaved });
                return res.status(200).json(response);
            }
        }

        // --- LAYER 2: INTELLIGENT MODEL ROUTING ---
        // Use ModelRouter to potentially downgrade to a cheaper model
        const routeResult = modelRouter.route(lastMessage);
        let effectiveProvider = routeResult.provider;
        let effectiveModel = routeResult.model;
        let routed = false;

        // Only route if budget allows and the router suggests a cheaper tier
        if (routeResult.budgetStatus.canProceed && routeResult.tier !== 'reasoning') {
            // Check if we can use a cheaper model than what was requested
            const requestedCost = tokenBudget.estimateCost('openai', model, 2000, 1000);
            const routedCost = tokenBudget.estimateCost(routeResult.provider, routeResult.model, 2000, 1000);

            if (routedCost < requestedCost * 0.7) {
                // Router found a significantly cheaper option (>30% savings)
                routed = true;
                LogService.log('gateway', 'info', `Router: ${model} → ${effectiveModel} (${routeResult.reason})`);
            } else {
                // Use the originally requested model
                effectiveProvider = 'openai';
                if (model.includes('claude')) effectiveProvider = 'anthropic';
                if (model.includes('gemini')) effectiveProvider = 'gemini';
                effectiveModel = model;
            }
        } else {
            // Budget blocked or complex query — use requested model
            effectiveProvider = 'openai';
            if (model.includes('claude')) effectiveProvider = 'anthropic';
            if (model.includes('gemini')) effectiveProvider = 'gemini';
            effectiveModel = model;
        }

        const validTypes = ['openai', 'anthropic', 'gemini', 'moonshot', 'grok', 'perplexity'];
        if (!validTypes.includes(effectiveProvider)) effectiveProvider = 'openai';

        LogService.log('gateway', 'info', `Cache MISS: forwarding to ${effectiveProvider}/${effectiveModel}`);

        const provider = LLMFactory.createProvider(effectiveProvider as any);
        const result = await provider.chat(messages, { model: effectiveModel, temperature });

        // Record spend
        if (result.usage) {
            tokenBudget.recordSpend({
                timestamp: new Date(),
                provider: effectiveProvider,
                model: effectiveModel,
                inputTokens: result.usage.inputTokens || 0,
                outputTokens: result.usage.outputTokens || 0,
                costUsd: tokenBudget.estimateCost(effectiveProvider, effectiveModel, result.usage.inputTokens || 0, result.usage.outputTokens || 0),
                taskType: 'proxy'
            });
        }

        // If we routed to a cheaper model, calculate the savings
        let routingSavings = 0;
        if (routed && result.usage) {
            const originalCost = tokenBudget.estimateCost('openai', model, result.usage.inputTokens || 0, result.usage.outputTokens || 0);
            const actualCost = tokenBudget.estimateCost(effectiveProvider, effectiveModel, result.usage.inputTokens || 0, result.usage.outputTokens || 0);
            routingSavings = Math.max(0, originalCost - actualCost);
            if (routingSavings > 0) {
                await savingsTracker.recordSaving(apiKey || 'anonymous', routingSavings, 'model_routing', effectiveModel);
            }
        }

        // --- LAYER 3: HARVEST (Async Cache for next time) ---
        await LidarCacheService.cacheSemantic(lastMessage, result.content);

        // Transform to OpenAI format
        const openAIResponse = {
            id: `chatcmpl-${Date.now()}`,
            object: 'chat.completion',
            created: Date.now(),
            model: result.model || effectiveModel,
            choices: [{
                index: 0,
                message: { role: 'assistant', content: result.content },
                finish_reason: 'stop'
            }],
            usage: result.usage
        };

        // Inform caller about routing decisions
        res.setHeader('X-Cache', 'MISS');
        if (routed) {
            res.setHeader('X-Model-Routed', `${model} → ${effectiveModel}`);
            res.setHeader('X-Routing-Tier', routeResult.tier);
            res.setHeader('X-Cost-Saved', routingSavings.toFixed(6));
        }

        return res.status(200).json(openAIResponse);

    } catch (error) {
        LogService.log('gateway', 'error', `Gateway Failure: ${error.message}`);
        console.error('Gateway Error:', error);
        return res.status(500).json({ error: 'Internal Gateway Error', details: error.message });
    }
}
