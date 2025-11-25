import { describe, it, expect } from 'vitest';
import {
    calculateComplexity,
    validateComplexityForPlan,
    suggestOptimizations,
    COMPLEXITY_TIERS
} from '../../lib/complexity-calculator.js';

describe('Complexity Calculator', () => {
    describe('calculateComplexity', () => {
        it('should calculate simple pipeline complexity correctly', () => {
            const pipeline = {
                nodes: [
                    { type: 'http_api' },
                    { type: 'cache_l1' },
                    { type: 'http_response' }
                ],
                sector: 'general'
            };

            const result = calculateComplexity(pipeline);

            expect(result.tier).toBe('simple');
            expect(result.cost).toBe(0);
            expect(result.score).toBeLessThan(20);
        });

        it('should calculate moderate pipeline complexity correctly', () => {
            const pipeline = {
                nodes: [
                    { type: 'http_api' },
                    { type: 'cache_l1' },
                    { type: 'cache_l2' },
                    { type: 'llm_basic' },
                    { type: 'http_response' }
                ],
                sector: 'finance' // 1.5x multiplier
            };

            const result = calculateComplexity(pipeline);

            expect(result.tier).toBe('moderate');
            expect(result.cost).toBe(25);
        });

        it('should calculate complex pipeline complexity correctly', () => {
            const pipeline = {
                nodes: [
                    { type: 'ehr_connector' },
                    { type: 'phi_filter' }, // High weight
                    { type: 'hipaa_audit' }, // High weight
                    { type: 'llm_advanced' },
                    { type: 'cache_l2' },
                    { type: 'http_response' }
                ],
                sector: 'healthcare' // 1.5x multiplier
            };

            const result = calculateComplexity(pipeline);

            expect(result.tier).toBe('complex');
            expect(result.cost).toBe(75);
        });

        it('should throw error for invalid pipeline', () => {
            expect(() => calculateComplexity({})).toThrow('Invalid pipeline: nodes array required');
        });
    });

    describe('validateComplexityForPlan', () => {
        it('should allow simple pipeline on starter plan', () => {
            const result = validateComplexityForPlan('simple', 'starter');
            expect(result.allowed).toBe(true);
            expect(result.upgrade_required).toBe(false);
        });

        it('should not allow complex pipeline on starter plan', () => {
            const result = validateComplexityForPlan('complex', 'starter');
            expect(result.allowed).toBe(false);
            expect(result.upgrade_required).toBe(true);
            expect(result.required_plan).toBe('enterprise');
        });

        it('should allow moderate pipeline on professional plan', () => {
            const result = validateComplexityForPlan('moderate', 'professional');
            expect(result.allowed).toBe(true);
        });
    });

    describe('suggestOptimizations', () => {
        it('should suggest removing audit nodes for complex pipelines', () => {
            const pipeline = {
                nodes: [
                    { id: 'n1', type: 'hipaa_audit' },
                    { id: 'n2', type: 'cache_l1' }
                ],
                sector: 'healthcare'
            };

            const complexity = {
                tier: 'complex',
                score: 60
            };

            const suggestions = suggestOptimizations(pipeline, complexity);

            // Should have remove_nodes AND change_sector (since healthcare has multiplier)
            expect(suggestions.length).toBeGreaterThanOrEqual(1);

            const removeNodes = suggestions.find(s => s.type === 'remove_nodes');
            expect(removeNodes).toBeDefined();
            expect(removeNodes.nodes).toContain('n1');
        });

        it('should suggest sector change if multiplier is high', () => {
            const pipeline = {
                nodes: [{ type: 'cache_l1' }],
                sector: 'healthcare'
            };

            const complexity = {
                tier: 'moderate',
                score: 30
            };

            const suggestions = suggestOptimizations(pipeline, complexity);

            const sectorChange = suggestions.find(s => s.type === 'change_sector');
            expect(sectorChange).toBeDefined();
            expect(sectorChange.to).toBe('general');
        });

        it('should return empty array for simple pipelines', () => {
            const complexity = { tier: 'simple' };
            const suggestions = suggestOptimizations({}, complexity);
            expect(suggestions).toEqual([]);
        });
    });
});
