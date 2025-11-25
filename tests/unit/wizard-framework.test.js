import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PipelineWizard } from '../../lib/wizard-framework.js';
import { platformMemory } from '../../lib/platform-memory.js';

// Mock platform memory to avoid DB calls
vi.mock('../../lib/platform-memory.js', () => ({
    platformMemory: {
        get: vi.fn(),
        set: vi.fn(),
        learn: vi.fn(),
        analyzePatterns: vi.fn()
    },
    NAMESPACES: {
        WIZARD: 'test/wizard'
    }
}));

describe('Pipeline Wizard', () => {
    let wizard;

    beforeEach(() => {
        wizard = new PipelineWizard();
        vi.clearAllMocks();
    });

    describe('analyzeUseCase', () => {
        it('should return learned pattern if found in memory', async () => {
            platformMemory.get.mockResolvedValue({
                hit: true,
                data: { nodes: ['mock_node'] },
                confidence: 0.9,
                usage_count: 5
            });

            const result = await wizard.analyzeUseCase('test prompt', { sector: 'general' });

            expect(result.learned).toBe(true);
            expect(result.suggestions).toEqual(['mock_node']);
            expect(result.confidence).toBe(0.9);
        });

        it('should infer nodes for new use case', async () => {
            platformMemory.get.mockResolvedValue({ hit: false });

            const result = await wizard.analyzeUseCase('medical diagnosis', { sector: 'healthcare' });

            expect(result.learned).toBe(false);
            expect(result.suggestions).toContain('phi_filter');
            expect(result.suggestions).toContain('hipaa_audit');
        });
    });

    describe('suggestNodes', () => {
        it('should return default nodes if no pattern found', async () => {
            platformMemory.get.mockResolvedValue({ hit: false });

            const result = await wizard.suggestNodes('unknown', 'general');

            expect(result.source).toBe('defaults');
            expect(result.nodes).toContain('cache_l1');
        });

        it('should return learned nodes if pattern found', async () => {
            platformMemory.get.mockResolvedValue({
                hit: true,
                data: { nodes: ['learned_node'] },
                confidence: 0.85
            });

            const result = await wizard.suggestNodes('known', 'general');

            expect(result.source).toBe('learned_pattern');
            expect(result.nodes).toEqual(['learned_node']);
        });
    });

    describe('optimizeConfiguration', () => {
        it('should suggest optimizations based on memory', async () => {
            platformMemory.get.mockResolvedValue({
                hit: true,
                data: {
                    optimizations: [{ type: 'remove_audit' }],
                    avg_savings: 50
                }
            });

            const pipeline = {
                nodes: [{ type: 'cache_l1' }],
                sector: 'general'
            };

            const result = await wizard.optimizeConfiguration(pipeline);

            expect(result.suggestions).toHaveLength(1);
            expect(result.proven_savings).toBe(50);
        });
    });

    describe('learnFromPipeline', () => {
        it('should save successful pipeline pattern', async () => {
            const pipeline = {
                nodes: [{ type: 'cache_l1' }],
                sector: 'general',
                use_case: 'test',
                complexity_tier: 'simple',
                complexity_score: 10,
                monthly_cost: 0
            };

            await wizard.learnFromPipeline(pipeline, true);

            expect(platformMemory.set).toHaveBeenCalled(); // Called via learn() which calls set()
            expect(platformMemory.set).toHaveBeenCalledTimes(2); // Once for nodes, once for complexity
        });

        it('should not learn from failed pipeline', async () => {
            await wizard.learnFromPipeline({}, false);
            expect(platformMemory.set).not.toHaveBeenCalled();
        });
    });
});
