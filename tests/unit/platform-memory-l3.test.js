import { describe, it, expect, vi, beforeEach } from 'vitest';
import { platformMemory } from '../../lib/platform-memory.js';

// Mock dependencies
const { mockQuery, mockUpsert } = vi.hoisted(() => ({
    mockQuery: vi.fn(),
    mockUpsert: vi.fn()
}));

vi.mock('@neondatabase/serverless', () => ({
    neon: () => vi.fn().mockResolvedValue([]) // Mock empty SQL results
}));

vi.mock('@upstash/vector', () => ({
    Index: class {
        constructor() {
            this.query = mockQuery;
            this.upsert = mockUpsert;
        }
    }
}));

describe('Platform Memory L3 (Vector Search)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Clear L1 cache
        platformMemory.l1Cache.clear();
    });

    describe('get', () => {
        it('should return L3 hit when semantic search is enabled', async () => {
            mockQuery.mockResolvedValue([{
                score: 0.95,
                metadata: { data: { result: 'semantic_match' } }
            }]);

            const result = await platformMemory.get('test', 'query', { semantic_search: true });

            expect(result.hit).toBe(true);
            expect(result.tier).toBe('L3');
            expect(result.data).toEqual({ result: 'semantic_match' });
            expect(result.confidence).toBe(0.95);
            expect(mockQuery).toHaveBeenCalledWith(expect.objectContaining({
                data: 'query',
                topK: 1
            }));
        });

        it('should return miss if similarity score is too low', async () => {
            mockQuery.mockResolvedValue([{
                score: 0.5, // Below default 0.8 threshold
                metadata: { data: { result: 'weak_match' } }
            }]);

            const result = await platformMemory.get('test', 'query', { semantic_search: true });

            expect(result.hit).toBe(false);
        });

        it('should not query vector index if semantic_search is false', async () => {
            await platformMemory.get('test', 'query', { semantic_search: false });
            expect(mockQuery).not.toHaveBeenCalled();
        });
    });

    describe('set', () => {
        it('should upsert to vector index when reasoning is provided', async () => {
            await platformMemory.set('test', 'key', { foo: 'bar' }, { reasoning: 'test reasoning' });

            expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
                id: 'test:key',
                data: 'test reasoning',
                metadata: expect.objectContaining({
                    namespace: 'test',
                    key: 'key'
                })
            }));
        });

        it('should not upsert if no text representation available', async () => {
            await platformMemory.set('test', 'key', { foo: 'bar' }); // No reasoning, data is object
            expect(mockUpsert).not.toHaveBeenCalled();
        });
    });
});
