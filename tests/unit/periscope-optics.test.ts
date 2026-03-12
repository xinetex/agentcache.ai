import { describe, it, expect, beforeAll } from 'vitest';
import { periscopeService } from '../../src/services/PeriscopeService.js';
import { db } from '../../src/db/client.js';
import { periscopePathStats } from '../../src/db/schema.js';

describe('Periscope Optical Refinement Unit Tests', () => {
    const candidates = [
        { id: 'c1', actionType: 'tool_call', toolName: 'test_tool', provider: 'test_provider' }
    ];

    beforeAll(async () => {
        // Mock stats in DB
        // Avg: 100, p95: 500
        await db.insert(periscopePathStats).values({
            actionKey: 'tool_call:test_tool:test_provider',
            avgLatencyMs: 100,
            p95LatencyMs: 500,
            avgTokenCost: 1000,
            successRate: 1.0,
            cacheHitRate: 0.0,
            sampleCount: 10,
            updatedAt: new Date()
        });
    });

    it('should use avg latency when ED is inactive (wide profile)', async () => {
        const result = await periscopeService.scoreCandidates(candidates, { profile: 'wide' });
        const c1 = result.candidates.find(c => c.id === 'c1');
        
        // Wide weights: latency: -1.5, token: -0.5, success: 1.0, cache: 0.5
        // Score = (-1.5 * 100) + (-0.5 * 1000) + (1.0 * 1.0) + (0.5 * 0.0)
        // Score = -150 - 500 + 1 = -649
        expect(c1.score).toBe(-649);
    });

    it('should use p95 latency when ED is active (tele profile)', async () => {
        const result = await periscopeService.scoreCandidates(candidates, { profile: 'tele' });
        const c1 = result.candidates.find(c => c.id === 'c1');
        
        // Tele weights: latency: -0.7, token: -0.5, success: 3.0, cache: 1.5
        // ED Active: uses p95 (500)
        // Score = (-0.7 * 500) + (-0.5 * 1000) + (3.0 * 1.0) + (1.5 * 0.0)
        // Score = -350 - 500 + 3 = -847
        expect(c1.score).toBe(-847);
    });

    it('should stabilize scores when VR is active (normal profile)', async () => {
        const result = await periscopeService.scoreCandidates(candidates, { profile: 'normal' });
        const c1 = result.candidates.find(c => c.id === 'c1');
        
        // Normal weights: latency: -1.0, token: -0.7, success: 2.0, cache: 1.0
        // ED Active: uses p95 (500)
        // Score = (-1.0 * 500) + (-0.7 * 1000) + (2.0 * 1.0) + (1.0 * 0.0)
        // Score = -500 - 700 + 2 = -1198.0
        
        expect(c1.score).toBe(-1198);
        expect(result.metadata.vrActive).toBe(true);
    });
});
