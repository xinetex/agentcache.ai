import { z } from 'zod';
import { createHash } from 'crypto';
import { redis } from '../lib/redis.js';
import { LLMFactory } from '../lib/llm/factory.js';

/**
 * LemmaService: The Ontological Sub-Task Router
 * 
 * Mathematically factorizes a prompt into sub-components (Lemmas), caches them independently, 
 * and synthesizes the unified result. 
 */
import { LLMProvider } from '../lib/llm/types.js';

/**
 * LemmaService: The Ontological Sub-Task Router
 * 
 * Mathematically factorizes a prompt into sub-components (Lemmas), caches them independently, 
 * and synthesizes the unified result. 
 */
export class LemmaService {
    private decompositionLlm: LLMProvider;
    private defaultExecutionLlm?: LLMProvider;

    constructor(decompositionLlm?: LLMProvider, defaultExecutionLlm?: LLMProvider) {
        // Dependency Injection: Allow custom LLMs to be injected
        this.decompositionLlm = decompositionLlm || LLMFactory.createProvider('inception');
        this.defaultExecutionLlm = defaultExecutionLlm;
    }

    /**
     * 1. Decompose the incoming prompt into logical independent tasks.
     * Uses Inception Labs for millisecond structural reasoning.
     */
    async decompose(prompt: string): Promise<Array<{ id: string, description: string }>> {
        const systemPrompt = `You are an Ontological Prompt Decomposer for an AI Caching system. 
Break the following complex user prompt into distinct, independent logical sub-tasks (Lemmas).
Aim for 2 to 4 distinct steps. If the prompt is too simple, return a single sub-task.

Return ONLY a valid JSON object matching this schema:
{
  "subtasks": [
    { "id": "step_1", "description": "Independent description of what needs to be solved (with enough context to solve it alone)" }
  ]
}`;
        // We use Inception for extreme speed in categorization
        const response = await this.decompositionLlm.chat([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
        ], { model: 'mercury' });

        const jsonMatch = response.content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (!jsonMatch) {
            console.warn("[LemmaService] Failed to parse decomposition JSON, falling back.");
            return [{ id: 'step_1', description: prompt }];
        }

        try {
            const parsed = JSON.parse(jsonMatch[0]);
            return parsed.subtasks || [{ id: 'step_1', description: prompt }];
        } catch (e) {
            return [{ id: 'step_1', description: prompt }];
        }
    }

    /**
     * 2. Resolve lemmas. Checks cache by deterministic hash.
     * Parallelizes cache-misses directly to the LLM.
     */
    async resolve(subtasks: Array<{ id: string, description: string }>, executionProvider: string = 'openai', executionModel: string = 'gpt-4o-mini') {
        // If a specific provider is passed to the method, we use it (backward compat),
        // otherwise we fall back to the injected default execution LLM.
        const llm = executionProvider === 'openai' && this.defaultExecutionLlm
            ? this.defaultExecutionLlm
            : LLMFactory.createProvider(executionProvider as any);

        const results: Record<string, string> = {};
        const metrics = { hits: 0, misses: 0, hit_ratio: 0.0 };

        await Promise.all(subtasks.map(async (task) => {
            // Canonicalize and hash the task description for the cache key
            const normalized = task.description.trim().toLowerCase();
            const hash = createHash('sha256').update(normalized).digest('hex');
            const cacheKey = `lemma:cache:v1:${hash}`;

            const cached = await redis.get(cacheKey);
            if (cached) {
                results[task.id] = cached as string;
                metrics.hits++;
            } else {
                metrics.misses++;
                // Miss: Fire LLM to solve this specific lemma in isolation
                const res = await llm.chat([{
                    role: 'system',
                    content: 'You are an isolated Sub-Task solver. Provide the exact solution for the requested task. Do not add introductory or concluding remarks.'
                }, {
                    role: 'user',
                    content: `Solve this sub-task:\n\n${task.description}`
                }], { model: executionModel });

                results[task.id] = res.content;
                // Cache the lemma for 7 days
                await redis.setex(cacheKey, 604800, res.content).catch(e => console.error('[LemmaService] Cache write error:', e));
            }
        }));

        const total = metrics.hits + metrics.misses;
        metrics.hit_ratio = total > 0 ? (metrics.hits / total) : 0;

        return { results, metrics };
    }

    /**
     * 3. Synthesize the final result fluidly.
     */
    async synthesize(originalPrompt: string, resolvedLemmas: Record<string, string>, synthesisProvider: string = 'openai', synthesisModel: string = 'gpt-4o-mini') {
        const llm = synthesisProvider === 'openai' && this.defaultExecutionLlm
            ? this.defaultExecutionLlm
            : LLMFactory.createProvider(synthesisProvider as any);

        let context = "Here are the resolved intermediate steps (Lemmas) for the task:\n\n";
        for (const [id, content] of Object.entries(resolvedLemmas)) {
            context += `--- STEP: ${id} ---\n${content}\n\n`;
        }

        const systemPrompt = `You are a Synthesizer. You must answer the user's original prompt by seamlessly weaving together the provided intermediate steps (Lemmas) previously computed by sub-agents. 
Make the final output fluid and cohesive. You may format it as requested by the user. 
DO NOT explicitly mention that you are stitching parts together or reference "Step 1" unless it makes sense for the user's format.`;

        const response = await llm.chat([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Original Prompt:\n${originalPrompt}\n\n${context}` }
        ], { model: synthesisModel });

        return response.content;
    }

    /**
     * Orchestrator
     */
    async chat(prompt: string, provider: string = 'openai', model: string = 'gpt-4o-mini') {
        const startTime = Date.now();

        // 1. Decompose
        const subtasks = await this.decompose(prompt);
        const decomposeTime = Date.now();

        // 2. Resolve (Parallel cache/LLM hits)
        const { results, metrics } = await this.resolve(subtasks, provider, model);
        const resolveTime = Date.now();

        // 3. Synthesize
        const finalAnswer = await this.synthesize(prompt, results, provider, model);
        const finishTime = Date.now();

        return {
            response: finalAnswer,
            subtasks: subtasks,
            metrics: {
                ...metrics,
                timing: {
                    decompose_ms: decomposeTime - startTime,
                    resolve_ms: resolveTime - decomposeTime,
                    synthesize_ms: finishTime - resolveTime,
                    total_ms: finishTime - startTime
                }
            }
        };
    }
}

export const lemmaService = new LemmaService();
