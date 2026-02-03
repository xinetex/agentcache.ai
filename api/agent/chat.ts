import { redactPII } from '../../src/lib/pii.js';
import { LLMFactory } from '../../src/lib/llm/factory.js';

import { SemanticRouter } from '../../src/lib/router.js';
import { createHash } from 'crypto';
import { redis } from '../../src/lib/redis.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req: Request, context: any): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 200 });

    try {
        const { message, sessionId, provider = 'moonshot', model } = await req.json();

        // 1. PII Redaction (Input Guard)
        const redactedMessage = redactPII(message);
        const wasRedacted = message !== redactedMessage;

        // 1.5. L1 Exact Cache Check (Hot Path)
        // SHA-256(redactedMessage + provider + model)
        const l1Hash = createHash('sha256')
            .update(redactedMessage + provider + (model || ''))
            .digest('hex');
        const l1Key = `cache:l1:${l1Hash}`;

        const cachedL1 = await redis.get(l1Key);
        if (cachedL1) {
            const l1Data = JSON.parse(cachedL1);
            return new Response(JSON.stringify({
                message: l1Data.message,
                contextSource: 'L1 (Exact Cache)',
                latency: Date.now() - (l1Data.timestamp || Date.now()), // Approx
                cached: true,
                metrics: {
                    reasoningTokensSaved: l1Data.reasoningTokens || 0,
                    actualReasoningTokens: 0,
                    piiRedacted: wasRedacted,
                    provider: provider,
                    model: model || 'default',
                    similarity: 1.0
                }
            }), {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Cache': 'HIT-L1',
                    'X-Cache-Score': '1.0'
                }
            });
        }

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

        // 5. Update L1 Exact Cache (Async)
        // TTL: 1 hour (3600s)
        const l1Payload = JSON.stringify({
            message: answer,
            reasoningTokens,
            timestamp: Date.now()
        });

        // Fire and forget L1 update
        redis.setex(l1Key, 3600, l1Payload).catch(err => console.error('L1 cache update failed:', err));

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
        console.error("AI Provider Error:", error);

        // Graceful Fallback for Demo/Quota limits
        if (error.message.includes('429') || error.message.includes('quota') || error.message.includes('Insufficient balance')) {
            const fallbackResponse = "I apologize, but my access to the external neural core (Moonshot API) is currently rate-limited or out of credits. \n\nHowever, I can still access local systems. How can I assist you with the internal dashboard data?";

            return new Response(JSON.stringify({
                message: fallbackResponse,
                contextSource: 'System (Fallback)',
                latency: 10,
                cached: false,
                metrics: {
                    provider: 'fallback',
                    error: error.message
                }
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
