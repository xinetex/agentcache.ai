import { beforeEach, describe, expect, it } from 'vitest';
import { redis } from '../../src/lib/redis.js';
import { executionControlService } from '../../src/services/ExecutionControlService.js';
import { executionDriftService } from '../../src/services/ExecutionDriftService.js';

describe('execution drift service', () => {
  beforeEach(async () => {
    const keys = await redis.keys('execution:*');
    const receiptKeys = await redis.keys('shared_receipt:*');
    for (const key of [...keys, ...receiptKeys, 'shared_receipts:index']) {
      await redis.del(key);
    }
  });

  it('stores shadow-mode drift evaluations without mutating the run', async () => {
    const created = await executionControlService.createContextPack({
      name: 'Robotics Review Pack',
      objective: 'Review a manipulator control plan before publish.',
      methodology: 'Draft, review, and hold for gate approval.',
      sectorHint: 'robotics',
      workflowPhases: ['draft', 'review', 'gate', 'finalize'],
      reviewerRoles: ['critical', 'compliance'],
    }, { principalId: 'org:test' });

    const started = await executionControlService.startRun({
      contextPackId: created.pack.id,
      inputPayload: { command: 'calibrate manipulator arm' },
      finalAction: 'publish',
    }, { principalId: 'org:test' });

    const evaluation = await executionDriftService.evaluateRun(started.run.id);
    const runAfter = await executionControlService.getRun(started.run.id);
    const evaluations = await executionDriftService.listRunEvaluations(started.run.id);

    expect(evaluation.mode).toBe('shadow');
    expect(evaluation.runId).toBe(started.run.id);
    expect(['stable', 'watch', 'drifting']).toContain(evaluation.verdict);
    expect(runAfter?.status).toBe(started.run.status);
    expect(evaluations).toHaveLength(1);
  });
});
