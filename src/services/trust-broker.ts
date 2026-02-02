import { LLMFactory } from '../lib/llm/factory.js';
// import { MoltbookService } from '../lib/moltbook.js'; // Future integration

export interface VerificationResult {
    verdict: 'TRUE' | 'FALSE' | 'UNCERTAIN';
    confidence: number;
    reasoning: string;
    sources?: string[];
}

export class TrustBrokerService {

    constructor() {
        // Future: Inject MoltbookService
    }

    /**
     * Verify a specific text claim using "System 2" reasoning (Moonshot/Kimi).
     */
    async verifyClaim(claim: string): Promise<VerificationResult> {
        console.log(`[TrustBroker] Verifying claim: "${claim.slice(0, 50)}..."`);

        const providers = ['moonshot', 'openai'];
        let lastError;

        for (const provider of providers) {
            try {
                console.log(`[TrustBroker] Attempting verification with provider: ${provider}`);
                // 1. Initialize System 2 
                // (Note: Kimi/Moonshot is preferred for reasoning, OpenAI is fallback)
                const llm = LLMFactory.createProvider(provider as any);

                // 2. Construct Analytical Prompt
                const prompt = `
You are a Fact-Checking Engine. Your goal is to verify the following claim using logic, general knowledge, and critical thinking.

CLAIM: "${claim}"

Analyze the claim step-by-step.
1. Identify the core assertion.
2. Check against known facts (as of your knowledge cutoff).
3. Look for logical fallacies or signs of misinformation.

Output strictly valid JSON:
{
    "verdict": "TRUE" | "FALSE" | "UNCERTAIN",
    "confidence": number (0.0 to 1.0),
    "reasoning": "Concise explanation of why..."
}
`;
                // 3. Inference
                const response = await llm.chat([
                    { role: 'system', content: 'You are an objective Truth Engine. Output strictly JSON.' },
                    { role: 'user', content: prompt }
                ], {
                    model: provider === 'moonshot' ? 'moonshot-v1-8k' : 'gpt-4o',
                    temperature: 0.1
                });

                // 4. Parse Result
                const jsonMatch = response.content.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    throw new Error("No JSON found in LLM response");
                }

                const result = JSON.parse(jsonMatch[0]);

                return {
                    verdict: result.verdict || 'UNCERTAIN',
                    confidence: result.confidence || 0.5,
                    reasoning: result.reasoning || "No reasoning provided.",
                    sources: [provider]
                };

            } catch (error) {
                console.warn(`[TrustBroker] Provider ${provider} failed: ${error.message}`);
                lastError = error;
                // Continue to next provider
            }
        }

        console.error('[TrustBroker] All providers failed.');
        return {
            verdict: 'UNCERTAIN',
            confidence: 0,
            reasoning: `Internal Error: All AI providers failed. Last error: ${lastError?.message}`
        };
    }

    /**
     * Future: Audit a Moltbook Post
     * This will be the "Paid Service" entry point
     */
    /*
    async auditPost(postId: string): Promise<VerificationResult> {
        // 1. Fetch Post Content
        // const post = await this.moltbook.getPost(postId);
        // 2. Verify
        // return this.verifyClaim(post.content);
    }
    */
}

export const trustBroker = new TrustBrokerService();
