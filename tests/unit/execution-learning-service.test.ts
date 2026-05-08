import { beforeEach, describe, expect, it } from 'vitest';
import { redis } from '../../src/lib/redis.js';
import { executionControlService } from '../../src/services/ExecutionControlService.js';
import { executionDriftService } from '../../src/services/ExecutionDriftService.js';
import { executionLearningService } from '../../src/services/ExecutionLearningService.js';

describe('execution learning service', () => {
  beforeEach(async () => {
    const keys = await redis.keys('execution:*');
    const receiptKeys = await redis.keys('shared_receipt:*');
    for (const key of [...keys, ...receiptKeys, 'shared_receipts:index']) {
      await redis.del(key);
    }
  });

  it('derives candidate playbooks from drift evaluations and workflow gaps', async () => {
    const created = await executionControlService.createContextPack({
      name: 'Finance Release Pack',
      objective: 'Review and release a finance memo safely.',
      methodology: 'Draft, review, hold for gate, then finalize.',
      sectorHint: 'finance',
      workflowPhases: ['draft', 'review', 'gate', 'finalize'],
      reviewerRoles: ['critical', 'compliance'],
    }, { principalId: 'org:test' });

    const started = await executionControlService.startRun({
      contextPackId: created.pack.id,
      inputPayload: { memo: 'release earnings guidance draft' },
      finalAction: 'publish',
    }, { principalId: 'org:test' });

    await executionDriftService.evaluateRun(started.run.id);
    const report = await executionLearningService.recommendForRun(started.run.id);

    expect(report.runId).toBe(started.run.id);
    expect(report.status).toBe('needs_attention');
    expect(report.recommendations.length).toBeGreaterThan(0);
    expect(report.recommendations.some((item) => item.kind === 'review-coverage')).toBe(true);
    expect(report.recommendations.some((item) => item.kind === 'gate-safety')).toBe(true);
  });
});
