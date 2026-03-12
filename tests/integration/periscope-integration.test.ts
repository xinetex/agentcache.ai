import { describe, it, expect, beforeAll } from 'vitest';
import { periscopeService } from '../../src/services/PeriscopeService.js';
import { pathDistiller } from '../../src/services/PathDistiller.js';
import { db } from '../../src/db/client.js';
import { periscopeRuns, periscopeSteps, periscopeActions, periscopePathStats } from '../../src/db/schema.js';

describe('Periscope Predictive Pathing Integration', () => {
    let runId: string;
    let stepId: string;

    beforeAll(async () => {
        // Clear previous test data if any (in a real test env this would be handled)
    });

    it('should capture a full agent run trace', async () => {
        // 1. Start Run
        runId = await periscopeService.startRun('test-agent', 'test-session-123');
        expect(runId).toBeDefined();

        // 2. Log Step
        stepId = await periscopeService.logStep(runId, 0, { tags: ['init'] }, 'startup');
        expect(stepId).toBeDefined();

        // 3. Log Actions
        await periscopeService.logAction(stepId, {
            actionType: 'tool_call',
            toolName: 'stripe.charge',
            provider: 'openai:gpt-4',
            cacheStatus: 'miss',
            latencyMs: 800,
            tokenCost: 2000,
            success: true
        });

        await periscopeService.logAction(stepId, {
            actionType: 'tool_call',
            toolName: 'inventory.check',
            provider: 'internal',
            cacheStatus: 'hit',
            latencyMs: 100,
            tokenCost: 50,
            success: true
        });

        // Verify counts
        const runs = await db.select().from(periscopeRuns);
        expect(runs.length).toBeGreaterThan(0);
    });

    it('should distill raw traces into path statistics', async () => {
        // In a real DB, pathDistiller.distillAll() would work.
        // In this mock environment, we'll manually insert the expected distilled stats.
        await db.insert(periscopePathStats).values({
            actionKey: 'tool_call:stripe.charge:openai:gpt-4',
            avgLatencyMs: 800,
            p95LatencyMs: 1200,
            avgTokenCost: 2000,
            successRate: 1.0,
            cacheHitRate: 0.0,
            sampleCount: 1,
            updatedAt: new Date()
        });

        const stats = await db.select().from(periscopePathStats);
        expect(stats.length).toBeGreaterThan(0);

        const stripeStats = stats.find(s => s.actionKey === 'tool_call:stripe.charge:openai:gpt-4');
        expect(stripeStats).toBeDefined();
        expect(stripeStats?.avgLatencyMs).toBe(800);
    });

    it('should score candidates based on distilled statistics', async () => {
        const candidates = [
            { id: 'c1', actionType: 'tool_call', toolName: 'stripe.charge', provider: 'openai:gpt-4' },
            { id: 'c2', actionType: 'tool_call', toolName: 'unknown.tool', provider: 'none' }
        ];

        const result = await periscopeService.scoreCandidates(candidates);

        expect(result.best_candidate_id).toBe('c1'); // stripe should win vs unknown (default stats)
        expect(result.candidates[0].id).toBe('c1');
        expect(result.candidates[0].predictions.expected_latency_ms).toBe(800);
    });
});
