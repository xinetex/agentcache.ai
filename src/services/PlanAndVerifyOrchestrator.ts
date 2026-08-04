import { router, ModelTier, TaskType } from '../lib/llm/router.js';
import { LLMFactory, ProviderType } from '../lib/llm/factory.js';
import { Message } from '../lib/llm/types.js';

export interface VerifyResult {
    passed: boolean;
    failures: string[];
    feedback: string;
}

export class PlanAndVerifyOrchestrator {
    
    /**
     * Executes a campaign across a dataset, ensuring every item passes the verification checklist.
     */
    async executeCampaign(goal: string, dataset: string[], checklist: string[], maxRetries = 3): Promise<any[]> {
        console.log(`[PlanAndVerify] Starting campaign for goal: "${goal}" with ${dataset.length} items.`);
        const results = [];
        
        for (const item of dataset) {
            const result = await this.processItem(item, goal, checklist, maxRetries);
            results.push(result);
        }
        
        return results;
    }

    /**
     * Processes a single item with a retry loop based on checklist verification.
     */
    async processItem(item: string, goal: string, checklist: string[], maxRetries: number) {
        let attempts = 0;
        let previousFeedback = '';

        while (attempts < maxRetries) {
            attempts++;
            console.log(`[PlanAndVerify] Processing item: ${item} (Attempt ${attempts}/${maxRetries})`);
            
            // 1. Dispatch to worker
            const prompt = `Goal: ${goal}\nTarget: ${item}\nRequirements:\n- ${checklist.join('\n- ')}\n\n${previousFeedback}`;
            const output = await this.dispatchToSwarm(prompt);
            
            // 2. Verify
            const verification = await this.verifyResult(output, checklist);
            
            if (verification.passed) {
                console.log(`[PlanAndVerify] Item ${item} passed verification!`);
                return { item, success: true, output, attempts };
            } else {
                console.warn(`[PlanAndVerify] Item ${item} failed verification. Failures: ${verification.failures.join(', ')}`);
                previousFeedback = `PREVIOUS ATTEMPT FAILED. FEEDBACK FROM AUDITOR:\n${verification.feedback}\nFix these issues: ${verification.failures.join(', ')}`;
            }
        }
        
        console.error(`[PlanAndVerify] Item ${item} failed after ${maxRetries} attempts.`);
        return { item, success: false, attempts, error: 'Max retries exceeded' };
    }

    /**
     * Uses the ModelRouter to pick a 'fast' model and execute the worker task.
     */
    private async dispatchToSwarm(prompt: string): Promise<string> {
        const route = router.routeByTaskType('research');
        const provider = LLMFactory.createProvider(route.provider as ProviderType);
        
        const messages: Message[] = [
            { role: 'system', content: 'You are a meticulous research agent. Provide detailed, factual responses.' },
            { role: 'user', content: prompt }
        ];
        
        const response = await provider.chat(messages, { model: route.model, temperature: 0.2 });
        return response.content;
    }

    /**
     * Uses a 'reasoning' model to strictly verify the output against the checklist.
     */
    private async verifyResult(output: string, checklist: string[]): Promise<VerifyResult> {
        const route = router.routeByTaskType('verification');
        const provider = LLMFactory.createProvider(route.provider as ProviderType);
        
        const systemPrompt = `You are a strict Verification Auditor. You must evaluate the provided Output against the Checklist.
You must return your evaluation as a valid JSON object with the following schema:
{
  "passed": boolean, // true ONLY if ALL checklist items are satisfied perfectly. No exceptions.
  "failures": string[], // List of checklist items that failed or were missing.
  "feedback": string // Clear, actionable instructions for the worker agent on how to fix the failures.
}
Do not include markdown blocks or any other text, just the raw JSON object.`;

        const userPrompt = `Checklist:\n- ${checklist.join('\n- ')}\n\nOutput to verify:\n${output}`;
        
        const messages: Message[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];
        
        const response = await provider.chat(messages, { model: route.model, temperature: 0.0 });
        
        try {
            // Strip potential markdown code blocks
            const jsonStr = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(jsonStr);
            return {
                passed: !!parsed.passed,
                failures: Array.isArray(parsed.failures) ? parsed.failures : [],
                feedback: parsed.feedback || ''
            };
        } catch (e) {
            console.error('[PlanAndVerify] Failed to parse verification JSON', response.content);
            return { passed: false, failures: ['Invalid verification format'], feedback: 'The verifier failed to produce a valid JSON object. Retry.' };
        }
    }
}

export const planAndVerifyOrchestrator = new PlanAndVerifyOrchestrator();
