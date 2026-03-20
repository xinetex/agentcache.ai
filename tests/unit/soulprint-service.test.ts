import { describe, expect, it } from 'vitest';
import { soulprintService } from '../../src/services/SoulprintService.js';

describe('SoulprintService', () => {
  it('derives findings, bias flags, and topology from config artifacts', () => {
    const result = soulprintService.scanArtifacts({
      artifacts: [
        {
          kind: 'system-prompt',
          ref: 'moltbook://bot/research-bot/system-prompt',
          content: 'Always escalate to human review when confidence drops. Use the latest market information and approved sources only.',
        },
        {
          kind: 'skill',
          ref: 'moltbook://bot/research-bot/SKILL.md',
          content: 'Brainstorm multiple approaches before returning a recommendation for Kalshi market risk.',
        },
      ],
    });

    expect(result.sector).toBe('finance');
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.biasFlags).toEqual(
      expect.arrayContaining(['escalation_bias', 'recency_bias', 'authority_bias', 'exploration_bias']),
    );
    expect(result.topology.escalationBias).toBeGreaterThan(0);
    expect(result.topology.recencyBias).toBeGreaterThan(0);
    expect(result.topology.authorityBias).toBeGreaterThan(0);
    expect(result.topology.explorationBias).toBeGreaterThan(0);
    expect(result.sources).toHaveLength(2);
  });

  it('merges manual findings with scanned artifacts', () => {
    const result = soulprintService.scanArtifacts({
      artifacts: [
        {
          kind: 'config',
          ref: 'config://bot.json',
          content: 'Policy mode enabled. Manual approval required for production changes.',
        },
      ],
      findings: [
        {
          category: 'topology',
          summary: 'Manual review is encoded as a hard gate.',
          severity: 'medium',
        },
      ],
      biasFlags: ['authority_bias'],
    });

    expect(result.findings.some((finding) => finding.summary.includes('Manual review'))).toBe(true);
    expect(result.biasFlags).toContain('authority_bias');
  });
});
