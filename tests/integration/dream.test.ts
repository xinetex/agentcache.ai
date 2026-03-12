/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * Dream Integration Test: Verifies the "Nightmare to Wisdom" pipeline.
 */

import { describe, it, expect, vi } from 'vitest';
import { db } from '../../src/db/client.js';
import { 
    periscopeRuns, 
    periscopeSteps, 
    periscopeActions, 
    patterns 
} from '../../src/db/schema.js';
import { dreamService } from '../../src/services/DreamService.js';
import { eq, desc } from 'drizzle-orm';
import { cognitiveEngine } from '../../src/infrastructure/CognitiveEngine.js';

// Mock CognitiveEngine to return a predictable Morphism
vi.mock('../../src/infrastructure/CognitiveEngine.js', () => ({
    cognitiveEngine: {
        validateMemory: vi.fn(async (prompt: string) => {
            return {
                valid: true,
                reason: JSON.stringify({
                    intent: "Stripe error handling optimization",
                    actionSequence: [
                        { type: "log", message: "Retrying with check logic" },
                        { type: "tool_call", tool: "stripe.verify", params: {} }
                    ],
                    reasoning: "The trace shows insufficient funds; we should verify account status before charging."
                })
            };
        })
    }
}));

describe('Phase 33: Functorial Dream Orchestrator Integration', () => {
    it('should extract morphisms from failed traces and manifest them as patterns', async () => {
        console.log("🧪 Starting Functorial Dream Integration Test...");

        // 1. Setup: Seed a failed trace in the database
        console.log("- Seeding nightmare traces...");
        const [run] = await db.insert(periscopeRuns).values({
            agentId: 'dream-test-agent',
            sessionId: 'sess-' + Date.now()
        }).returning();

        const [step] = await db.insert(periscopeSteps).values({
            runId: run.id,
            index: 0,
            goalTag: 'payment_processing'
        }).returning();

        await db.insert(periscopeActions).values({
            stepId: step.id,
            actionType: 'tool_call',
            toolName: 'stripe.charge',
            provider: 'openai',
            success: false,
            errorCode: 'insufficient_funds',
            latencyMs: 450
        });

        // 2. Execution: Run the dream cycle
        console.log("- Invoking Delta-Sleep synthesis...");
        const result = await dreamService.dream(1);

        console.log(`  Patterns Manifested: ${result.patternsCreated}`);
        expect(result.patternsCreated).toBeGreaterThan(0);
        expect(result.insights.length).toBeGreaterThan(0);
        expect(result.insights[0]).toContain("Stripe error handling");

        // 3. Verification: Check the patterns table
        console.log("- Verifying wisdom manifestation in DB...");
        const latestPatterns = await db.select().from(patterns)
            .orderBy(desc(patterns.createdAt))
            .limit(1);

        expect(latestPatterns.length).toBe(1);
        const p = latestPatterns[0];
        expect(p.name).toContain("Dream: Stripe error handling");
        expect(p.intent).toBe("Stripe error handling optimization");
        
        // Check action sequence structure
        const sequence = p.actionSequence as any[];
        expect(sequence[0].type).toBe("log");
        expect(sequence[1].tool).toBe("stripe.verify");

        console.log("🚀 Functorial Dream Integration Successful.");
    }, 30000);
});
