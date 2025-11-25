import { redactPII } from '../../src/lib/pii.js';
import { LLMFactory } from '../../src/lib/llm/factory.js';

import { SemanticRouter } from '../../src/lib/router.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req: Request, context: any): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 200 });

    try {
        const { message, sessionId, provider = 'moonshot', model } = await req.json();

        // 1. PII Redaction (Input Guard)
        const redactedMessage = redactPII(message);
        const wasRedacted = message !== redactedMessage;

        // 2. Semantic Cache Check (L2)
        const router = new SemanticRouter(0.90); // 90% similarity threshold
        const cacheResult = await router.find(redactedMessage);

        if (cacheResult.hit && cacheResult.response) {
            return new Response(JSON.stringify({
                message: cacheResult.response,
                contextSource: 'L2 (Semantic Cache)',
                latency: 45, // Typical cache latency
                cached: true,
                metrics: {
                    reasoningTokensSaved: cacheResult.metadata?.reasoningTokens || 0,
                    actualReasoningTokens: 0,
                    piiRedacted: wasRedacted,
                    provider: cacheResult.metadata?.provider || 'cache',
                    model: cacheResult.metadata?.model || 'cache',
                    similarity: cacheResult.score
                }
            }), {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Cache': 'HIT',
                    'X-Cache-Score': String(cacheResult.score)
                }
            });
        }

        // 3. Cognitive Processing (Swarm + LLM Factory)
        // We use the Factory to create the requested provider
        const llm = LLMFactory.createProvider(provider);

        // Construct messages
        const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
            { role: 'system', content: 'You are a helpful AI assistant with infinite memory.' },
            { role: 'user', content: redactedMessage }
        ];

        // Call Provider
        const response = await llm.chat(messages, { model });
        const answer = response.content;
        const reasoningTokens = response.usage.reasoningTokens || 0;

        // 4. Update Semantic Cache (Async)
        // We don't await this to keep latency low
        if (context?.waitUntil) {
            context.waitUntil(
                router.cache(redactedMessage, answer, {
                    provider: response.provider,
                    model: response.model,
                    reasoningTokens
                })
            );
        } else {
            // Fallback for environments without waitUntil (e.g. Node.js local dev)
            router.cache(redactedMessage, answer, {
                provider: response.provider,
                model: response.model,
                reasoningTokens
            }).catch(err => console.error('Cache update failed:', err));
        }

        return new Response(JSON.stringify({
            message: answer,
            contextSource: 'L1 (Hot)',
            latency: 1200, // Estimated LLM latency
            cached: false,
            metrics: {
                reasoningTokensSaved: 0,
                actualReasoningTokens: reasoningTokens,
                piiRedacted: wasRedacted,
                provider: response.provider,
                model: response.model
            }
        }), {
            headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS' }
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
