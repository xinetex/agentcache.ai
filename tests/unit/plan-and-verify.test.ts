import { describe, it, expect, vi } from 'vitest';
import { planAndVerifyOrchestrator } from '../../src/services/PlanAndVerifyOrchestrator.js';
import { LLMFactory } from '../../src/lib/llm/factory.js';
import { Message, CompletionResponse } from '../../src/lib/llm/types.js';

describe('PlanAndVerifyOrchestrator', () => {
    it('should successfully run a campaign and enforce checklist verification', async () => {
        const goal = "Research EV companies for basic financial data";
        const dataset = ["Tesla"];
        const checklist = [
            "Revenue and margin must be present",
            "Must include a source URL",
            "No field can be left empty"
        ];
        
        let attemptCount = 0;

        // Mock LLMFactory
        vi.spyOn(LLMFactory, 'createProvider').mockReturnValue({
            chat: async (messages: Message[]): Promise<CompletionResponse> => {
                const prompt = messages[messages.length - 1].content;
                
                // If it's the worker agent prompt
                if (prompt.includes('Target: Tesla')) {
                    if (attemptCount === 0) {
                        attemptCount++;
                        return {
                            content: "Tesla revenue is 96B. Margin is 15%. No URL provided.",
                            usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
                            model: 'mock', provider: 'mock'
                        };
                    } else {
                        return {
                            content: "Tesla revenue is 96B. Margin is 15%. Source: https://tesla.com",
                            usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
                            model: 'mock', provider: 'mock'
                        };
                    }
                }
                
                // If it's the verification agent prompt
                if (prompt.includes('Output to verify')) {
                    if (prompt.includes('No URL provided')) {
                        return {
                            content: JSON.stringify({ passed: false, failures: ["Must include a source URL"], feedback: "Add a source URL." }),
                            usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
                            model: 'mock', provider: 'mock'
                        };
                    } else {
                        return {
                            content: JSON.stringify({ passed: true, failures: [], feedback: "" }),
                            usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
                            model: 'mock', provider: 'mock'
                        };
                    }
                }
                
                return { content: '', usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }, model: '', provider: '' };
            }
        });
        
        const results = await planAndVerifyOrchestrator.executeCampaign(goal, dataset, checklist, 2);
        
        expect(results.length).toBe(1);
        const result = results[0];
        console.log("Verification result:", result);
        
        expect(result.success).toBe(true);
        expect(result.attempts).toBe(2);
    });
});
