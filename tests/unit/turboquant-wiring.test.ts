import { describe, it, expect, beforeEach, vi } from 'vitest';
import { semanticCacheService } from '../../src/services/SemanticCacheService.js';
import { platonicKeyService } from '../../src/services/PlatonicKeyService.js';
import { cognitiveMemory } from '../../src/services/cognitive-memory.js';
import * as embeddings from '../../src/lib/llm/embeddings.js';
import { redis } from '../../src/lib/redis.js';

vi.mock('../../src/lib/llm/embeddings.js', () => ({
    generateEmbedding: vi.fn()
}));

vi.mock('../../src/services/cognitive-memory.js', async (importOriginal) => {
    const original = await importOriginal() as any;
    return {
        ...original,
        cognitiveMemory: {
            ...original.cognitiveMemory,
            assessDrift: vi.fn().mockResolvedValue({ drift: 0, status: 'healthy' }),
            observeTransition: vi.fn().mockResolvedValue(undefined),
            recordCacheOutcome: vi.fn().mockResolvedValue(undefined),
            predictNext: vi.fn().mockResolvedValue([])
        }
    };
});

describe('TurboQuant Wiring (Lidar Hits)', () => {
    beforeEach(async () => {
        // Clear redis mock between runs
        if (redis.isMock) {
            // MockRedis has no clear(), so we'll just ignore for now or 
            // rely on unique session/sector IDs.
        }
    });

    it('should achieve a LIDAR HIT for semantically similar prompts', async () => {
        const sector = 'test-wiring-' + Date.now();
        const messages1 = [{ role: 'user', content: 'Original Prompt' }];
        const response = 'The capital of France is Paris.';
        
        // Mock constant embedding for "Original" and "Similar"
        const mockVec = Array(1536).fill(0).map((_, i) => Math.sin(i));
        (embeddings.generateEmbedding as any).mockResolvedValue(mockVec);

        // 1. Store the original response in the cache
        await semanticCacheService.set({
            messages: messages1,
            model: 'gpt-4',
            provider: 'openai',
            response,
            sector
        });

        // 2. Attempt to retrieve with a DIFFERENT prompt that returns the SAME embedding
        const messages2 = [{ role: 'user', content: 'Different Prompt' }];
        
        const result = await semanticCacheService.check({
            messages: messages2,
            model: 'claude-3-opus',
            provider: 'anthropic',
            sector,
            semantic: true
        });

        // 3. Verify it was a LIDAR HIT
        expect(result.hit).toBe(true);
        expect(result.type).toBe('lidar');
        expect(result.reason).toBe('semantic');
        expect(result.response).toBe(response);
        expect(result.originalProvider).toBe('openai');
        expect(result.originalModel).toBe('gpt-4');
        
        console.log(`[WiringTest] ✅ Verified LIDAR HIT for near-match query.`);
    });

    it('should NOT hit for semantically unrelated prompts', async () => {
        const sector = 'test-wiring-miss-' + Date.now();
        const messages1 = [{ role: 'user', content: 'Question A' }];
        
        const vecA = Array(1536).fill(0).map((_, i) => Math.cos(i));
        const vecB = Array(1536).fill(0).map((_, i) => Math.sin(i));

        (embeddings.generateEmbedding as any)
            .mockResolvedValueOnce(vecA) // For set
            .mockResolvedValueOnce(vecB); // For query

        await semanticCacheService.set({
            messages: messages1,
            model: 'gpt-4',
            response: 'Answer A',
            sector
        });

        const messages2 = [{ role: 'user', content: 'Question B' }];
        
        const result = await semanticCacheService.check({
            messages: messages2,
            model: 'gpt-4',
            sector
        });

        expect(result.hit).toBe(false);
        expect(result.reason).toBe('miss');
    });
});
