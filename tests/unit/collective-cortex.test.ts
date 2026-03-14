import { describe, expect, it, vi } from 'vitest';
import { redis } from '../../src/lib/redis.js';

vi.mock('../../src/services/SectorSolutionOrchestrator.js', () => ({
  sectorSolutionOrchestrator: {
    getActiveSolutions: async () => [
      { agentId: 'agent-finance', sector: 'FINTECH' },
      { agentId: 'agent-legal', sector: 'LEGAL' },
    ],
  },
}));

vi.mock('../../src/infrastructure/CognitiveEngine.js', () => ({
  cognitiveEngine: {
    synthesizeJointDirectives: async (jointContext: any) => {
      const directives: Record<string, string> = {};
      Object.keys(jointContext.perAgentState).forEach((agentId) => {
        directives[agentId] = `directive-for-${agentId}`;
      });
      return directives;
    },
  },
}));

describe('CollectiveCortex', () => {
  it('indexes joint sessions separately from session history keys', async () => {
    const { collectiveCortex } = await import('../../src/services/CollectiveCortex.js');
    const objective = `Joint objective ${Date.now()}`;

    await redis.set('session:test-history:history', JSON.stringify([{ event: 'legacy-history' }]));

    const session = await collectiveCortex.initiateSession(objective, ['agent-finance', 'agent-legal']);
    await collectiveCortex.pushState(session.id, 'agent-finance', { alpha: 1 });
    await collectiveCortex.pushState(session.id, 'agent-legal', { beta: 2 });

    const sessions = await collectiveCortex.listActiveSessions();
    const stored = sessions.find((candidate) => candidate.id === session.id);

    expect(stored).toBeDefined();
    expect(stored?.objective).toBe(objective);
    expect(stored?.status).toBe('CONVERGED');
    expect(stored?.participants).toEqual(['agent-finance', 'agent-legal']);
    expect(stored?.directives).toEqual({
      'agent-finance': 'directive-for-agent-finance',
      'agent-legal': 'directive-for-agent-legal',
    });
    expect(sessions.some((candidate) => candidate.id === 'session:test-history:history')).toBe(false);
  });
});
