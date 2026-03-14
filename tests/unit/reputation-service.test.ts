import { describe, expect, it } from 'vitest';
import { reputationService } from '../../src/services/ReputationService.js';

describe('ReputationService', () => {
  it('computes degrading sector health from tracked sector-specific stats', async () => {
    await reputationService.trackStat('finance-alpha-agent', 'totalTasks', 20);
    await reputationService.trackStat('finance-alpha-agent', 'cognitiveErrors', 12);
    await reputationService.trackStat('finance-alpha-agent', 'humanOverrides', 4);

    const sectorHealth = reputationService.getSectorReputation('finance');

    expect(sectorHealth.agentCount).toBeGreaterThanOrEqual(1);
    expect(sectorHealth.average).toBeLessThan(0.7);
    expect(['degrading', 'critical']).toContain(sectorHealth.status);
  });

  it('falls back to tracked stats when no maturity ledger exists', async () => {
    await reputationService.trackStat('legal-beta-agent', 'totalTasks', 10);
    await reputationService.trackStat('legal-beta-agent', 'cognitiveErrors', 1);
    await reputationService.trackStat('legal-beta-agent', 'humanOverrides', 1);

    const reputation = await reputationService.getReputation('legal-beta-agent');

    expect(reputation.reputation).toBeGreaterThan(0.5);
    expect(reputation.status).not.toBe('suspicious');
  });
});
