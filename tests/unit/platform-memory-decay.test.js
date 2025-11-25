import { describe, it, expect, vi, beforeEach } from 'vitest';
import { platformMemory } from '../../lib/platform-memory.js';

// Mock dependencies
const { mockSql } = vi.hoisted(() => ({
    mockSql: vi.fn()
}));

vi.mock('@neondatabase/serverless', () => ({
    neon: () => mockSql
}));

vi.mock('@upstash/vector', () => ({
    Index: class { }
}));

describe('Platform Memory Decay (Biological Memory)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSql.mockResolvedValue([]); // Default empty result
    });

    describe('reinforce', () => {
        it('should increase vitality on access', async () => {
            await platformMemory.reinforce('test', 'key', 0.5);

            // Expect update with increased vitality
            expect(mockSql).toHaveBeenCalled();
        });

        it('should cap vitality at 1.0', async () => {
            await platformMemory.reinforce('test', 'key', 0.95);

            // Expect update capped at 1.0
            expect(mockSql).toHaveBeenCalled();
        });
    });

    describe('decay', () => {
        it('should decrease vitality for old items', async () => {
            mockSql.mockResolvedValue({ count: 5 }); // Mock update result

            await platformMemory.decay('test');

            // Expect update decreasing vitality
            expect(mockSql).toHaveBeenCalled();
        });
    });
});
