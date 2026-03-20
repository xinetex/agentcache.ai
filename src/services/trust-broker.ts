/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
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
     * Verify a specific text claim using a "Dual Stack" approach:
     * 1. Triage (GPT-5.4 Nano - Minimal Tier)
     * 2. Verification (Claude 3.5 Sonnet - Balanced Tier)
     */
    async verifyClaim(claim: string): Promise<VerificationResult> {
        console.log(`[TrustBroker] Initializing Dual Stack Verification for: "${claim.slice(0, 50)}..."`);

        const { router } = await import('../lib/llm/router.js');

        // --- PHASE 1: TRIAGE (Minimal Tier - GPT-5.4 Nano) ---
        try {
            const triageRoute = router.routeByTaskType('triage');
            const triageLlm = LLMFactory.createProvider(triageRoute.provider as any);
            
            console.log(`[TrustBroker] Triage started with ${triageRoute.model} (${triageRoute.tier})`);
            
            const triagePrompt = `
Classify the following claim for verification.
CLAIM: "${claim}"

Categories:
- VERIFIABLE: Concrete fact that can be checked.
- JUNK: Gibberish, spam, or incoherent.
- TRIVIAL: Common knowledge or opinion (e.g., "The sky is blue").
- BIASED: Highly subjective or political.

Output JSON: { "category": "VERIFIABLE" | "JUNK" | "TRIVIAL" | "BIASED", "reason": "..." }
`;
            const triageRes = await triageLlm.chat([
                { role: 'system', content: 'You are a Triage Agent. Output strictly JSON.' },
                { role: 'user', content: triagePrompt }
            ], { model: triageRoute.model, temperature: 0 });

            const triageResult = JSON.parse(triageRes.content.match(/\{[\s\S]*\}/)?.[0] || '{}');
            
            if (triageResult.category === 'JUNK' || triageResult.category === 'TRIVIAL') {
                console.log(`[TrustBroker] Triage filtered claim as ${triageResult.category}. Skipping full verification.`);
                return {
                    verdict: triageResult.category === 'TRIVIAL' ? 'TRUE' : 'UNCERTAIN',
                    confidence: 0.9,
                    reasoning: `Filtered during triage: ${triageResult.reason}`
                };
            }
            
            console.log(`[TrustBroker] Triage passed: ${triageResult.category}. Proceeding to System 2.`);
        } catch (err) {
            console.warn(`[TrustBroker] Triage phase failed, falling back to full verification: ${err.message}`);
        }

        // --- PHASE 2: VERIFICATION (Balanced Tier - Claude 3.5 Sonnet) ---
        const verificationRoute = router.routeByTaskType('verification');
        const llm = LLMFactory.createProvider(verificationRoute.provider as any);

        try {
            console.log(`[TrustBroker] Attempting verification with: ${verificationRoute.provider}/${verificationRoute.model}`);
            
            const prompt = `
You are a Fact-Checking Engine. Your goal is to verify the following claim using logic, general knowledge, and critical thinking.

CLAIM: "${claim}"

Analyze the claim step-by-step.
1. Identify the core assertion.
2. Check against known facts.
3. Look for logical fallacies or signs of misinformation.

Output strictly valid JSON:
{
    "verdict": "TRUE" | "FALSE" | "UNCERTAIN",
    "confidence": number,
    "reasoning": "..."
}
`;
            const response = await llm.chat([
                { role: 'system', content: 'You are an objective Truth Engine. Output strictly JSON.' },
                { role: 'user', content: prompt }
            ], {
                model: verificationRoute.model,
                temperature: 0.1
            });

            const jsonMatch = response.content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("No JSON found in LLM response");

            const result = JSON.parse(jsonMatch[0]);

            return {
                verdict: result.verdict || 'UNCERTAIN',
                confidence: result.confidence || 0.5,
                reasoning: result.reasoning || "No reasoning provided.",
                sources: [verificationRoute.provider]
            };

        } catch (error) {
            console.error(`[TrustBroker] Verification failed: ${error.message}`);
            return {
                verdict: 'UNCERTAIN',
                confidence: 0,
                reasoning: `Internal Error: Verification failed. ${error.message}`
            };
        }
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
