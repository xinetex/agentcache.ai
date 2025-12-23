import { describe, it, expect, vi } from 'vitest';
import { UniversalOperator } from '../../src/integral/UniversalOperator.js';
import { Simulator } from '../../src/integral/Simulator.js';

describe('UniversalOperator', () => {
    it('should plan, simulate, and execute a goal', async () => {
        // Mock the Simulator
        const simulator = new Simulator();
        vi.spyOn(simulator, 'getAbstraction').mockResolvedValue('System is stable. User is admin.');
        vi.spyOn(simulator, 'simulateAction').mockResolvedValue({
            outcome: 'Mock success',
            confidence: 1.0,
            risks: []
        });

        const operator = new UniversalOperator(simulator);

        // Spy on console.log to verify execution flow (since we're logging for the demo)
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

        // Execute
        await operator.executeGoal('manage memory and optimize');

        // Verify key interactions
        expect(simulator.getAbstraction).toHaveBeenCalled();
        expect(simulator.simulateAction).toHaveBeenCalledWith('agentcache_compress_context', expect.any(Object));

        // Restore mocks
        vi.restoreAllMocks();
    });

    it('should warn on high-risk actions', async () => {
        const simulator = new Simulator();
        vi.spyOn(simulator, 'getAbstraction').mockResolvedValue('System is stable.');
        vi.spyOn(simulator, 'simulateAction').mockResolvedValue({
            outcome: 'Files deleted',
            confidence: 0.9,
            risks: ['Data Loss']
        });

        const operator = new UniversalOperator(simulator);
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

        // Execute a goal that triggers the 'manage memory' plan which we mock to Return high risk
        await operator.executeGoal('manage memory');

        expect(warnSpy).toHaveBeenCalled();
        vi.restoreAllMocks();
    });
});
