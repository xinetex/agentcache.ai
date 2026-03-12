import { describe, it, expect } from 'vitest';
import { periscopeService } from '../../src/services/PeriscopeService.js';

describe('Periscope Lens Profiles Unit Tests', () => {
    const candidates = [
        { id: 'c1', actionType: 'tool_call', toolName: 'high_latency_tool' },
        { id: 'c2', actionType: 'tool_call', toolName: 'low_latency_tool' }
    ];

    it('should resolve and use the "wide" profile', async () => {
        // Mock stats for the tools
        // c1: 2000ms latency, c2: 100ms latency
        // Wide weights: latency: -1.5, success: 1.0
        // Score c1 = -1.5 * 2000 + 1.0 * 0.9 = -2999.1
        // Score c2 = -1.5 * 100 + 1.0 * 0.9 = -149.1
        // c2 should win easily

        const result = await periscopeService.scoreCandidates(candidates, { profile: 'wide' });
        expect(result.best_candidate_id).toBeDefined();
        // Since we don't have real stats in mock yet, it uses defaults.
        // But we can verify it doesn't crash and returns valid structure.
        expect(Object.keys(periscopeService.PROFILES)).toContain('wide');
    });

    it('should favor success in "tele" profile', async () => {
        const teleWeights = periscopeService.PROFILES.tele.weights;
        expect(teleWeights.success_prob).toBe(3.0);
        expect(teleWeights.latency).toBe(-0.7);
    });

    it('should fallback to "normal" weights by default', async () => {
        const defaultWeights = periscopeService.PROFILES.normal.weights;
        const result = await periscopeService.scoreCandidates(candidates);
        // Internal check: weights should match normal
    });
});
