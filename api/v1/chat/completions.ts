
import { LidarCacheService } from '../../../src/services/LidarCacheService.js';
import { LLMFactory } from '../../../src/lib/llm/factory.js';
import { LogService } from '../../../src/services/LogService.js'; // Assuming we have or will create this for Mission Control

export default async function handler(req, res) {
    // 1. Method Check
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { messages, model = 'gpt-4o', temperature = 0.7, stream = false } = req.body;
    const apiKey = req.headers['authorization'];

    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Invalid messages format' });
    }

    const lastMessage = messages[messages.length - 1].content;

    try {
        // --- LAYER 0: COMPLIANCE (PII Redaction) ---
        // Use Case 21: Redact PII
        // Stub: Check for credit card or SSN patterns
        const piiPattern = /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/; // Simple CC regex
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
        // Only cache user queries, system prompts complicate semantic match without more logic
        if (messages.length > 0) {
            const cachedResponse = await LidarCacheService.getSemantic(lastMessage, 0.1);
            if (cachedResponse) {
                // Formatting response to look like OpenAI
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
                    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } // Cache is free
                };

                // Log Hit
                LogService.log('gateway', 'success', `Cache HIT for: ${lastMessage.substring(0, 30)}...`, { latency: 10 });

                return res.status(200).json(response);
            }
        }

        // --- LAYER 2: LLM FORWARDING (The Miss) ---
        // Log Miss
        LogService.log('gateway', 'info', `Cache MISS for: ${lastMessage.substring(0, 30)}... forwarding to ${model}`);

        // Decide Provider based on model name or default to OpenAI
        // Ideally we map 'gpt-4' -> openai, 'claude' -> anthropic
        let providerType = 'openai';
        if (model.includes('claude')) providerType = 'anthropic';
        if (model.includes('gemini')) providerType = 'gemini';

        // Pass user's key if they provided one, else use ours (Platform vs BYOK mode)
        // For this implementation, we assume Platform Key (ours) unless header mimics Bearer sk-...
        // Fix: Explicitly cast or check valid type to satisfy TypeScript
        const validTypes = ['openai', 'anthropic', 'gemini', 'moonshot', 'grok', 'perplexity'];
        if (!validTypes.includes(providerType)) providerType = 'openai';

        const provider = LLMFactory.createProvider(providerType as any);

        const result = await provider.chat(messages, { model, temperature });

        // --- LAYER 3: HARVEST (Async Cache) ---
        // We catch the result and store it for next time
        // Note: For now we only cache the exact answer. In future, we cache the "Thought Process" too.
        await LidarCacheService.cacheSemantic(lastMessage, result.content);

        // Transform back to OpenAI format if provider didn't (Factory usually returns normalized, but let's ensure)
        const openAIResponse = {
            id: `chatcmpl-${Date.now()}`,
            object: 'chat.completion',
            created: Date.now(),
            model: result.model || model,
            choices: [{
                index: 0,
                message: { role: 'assistant', content: result.content },
                finish_reason: 'stop'
            }],
            usage: result.usage
        };

        return res.status(200).json(openAIResponse);

    } catch (error) {
        LogService.log('gateway', 'error', `Gateway Failure: ${error.message}`);
        console.error('Gateway Error:', error);
        return res.status(500).json({ error: 'Internal Gateway Error', details: error.message });
    }
}
