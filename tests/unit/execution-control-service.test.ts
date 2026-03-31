import { beforeEach, describe, expect, it } from 'vitest';
import { redis } from '../../src/lib/redis.js';
import { executionControlService } from '../../src/services/ExecutionControlService.js';

describe('execution control service', () => {
  beforeEach(async () => {
    const keys = await redis.keys('execution:*');
    const receiptKeys = await redis.keys('shared_receipt:*');
    for (const key of [...keys, ...receiptKeys, 'shared_receipts:index']) {
      await redis.del(key);
    }
  });

  it('creates a context pack and drives a gated run through review and approval', async () => {
    const created = await executionControlService.createContextPack({
      name: 'Finance Release Gate',
      objective: 'Review a finance memo before it is published externally.',
      methodology: 'Classify, critique, and require approval before release.',
      conventions: ['Prefer exact figures', 'Flag unverifiable claims'],
      tools: ['retrieval', 'policy-check'],
      policyProfile: { verticalSku: 'finance-memory-fabric' },
      sectorHint: 'finance',
      workflowPhases: ['draft', 'review', 'gate', 'finalize'],
      reviewerRoles: ['critical', 'compliance'],
      sources: [
        {
          kind: 'policy',
          uri: 'ac://policies/finance/release',
          title: 'Finance release policy',
        },
      ],
    }, { principalId: 'org:test' });

    expect(created.pack.latestVersion).toBe(1);
    expect(created.version.policy.evidenceMode).toBe('audit');
    expect(created.version.reviewerRoles).toEqual(['critical', 'compliance']);

    const started = await executionControlService.startRun({
      contextPackId: created.pack.id,
      inputPayload: { documentId: 'doc-001' },
      finalAction: 'publish',
    }, { principalId: 'org:test' });

    expect(started.run.currentPhase).toBe('draft');
    expect(started.run.status).toBe('in_progress');
    expect(started.run.gateStatus).toBe('pending');
    expect(started.gate?.status).toBe('pending');

    const movedToReview = await executionControlService.advancePhase({
      runId: started.run.id,
      phase: 'review',
    });

    expect(movedToReview.currentPhase).toBe('review');
    expect(movedToReview.status).toBe('awaiting_review');

    const criticalReview = await executionControlService.recordReview({
      runId: started.run.id,
      reviewerRole: 'critical',
      verdict: 'PASS',
      summary: 'No blocking issues found.',
      findings: ['Citations intact'],
      confidence: 0.91,
    });

    expect(criticalReview.run.status).toBe('awaiting_review');
    expect(criticalReview.run.completedReviewerRoles).toEqual(['critical']);

    const reviewed = await executionControlService.recordReview({
      runId: started.run.id,
      reviewerRole: 'compliance',
      verdict: 'PASS',
      summary: 'Complies with finance release policy.',
      findings: ['Disclosure rules satisfied'],
      confidence: 0.94,
    });

    expect(reviewed.run.status).toBe('awaiting_gate');
    expect(reviewed.run.reviewVerdict).toBe('PASS');
    expect(reviewed.run.currentPhase).toBe('gate');

    const decided = await executionControlService.decideGate({
      gateId: started.gate!.id,
      decision: 'approved',
      decidedBy: 'admin:test',
      note: 'Approved for external release.',
    });

    expect(decided.run.status).toBe('completed');
    expect(decided.gate.status).toBe('approved');

    const bundle = await executionControlService.getRunBundle(started.run.id);
    expect(bundle?.reviews).toHaveLength(2);
    expect(bundle?.gate?.decisionNote).toContain('Approved');
  });
});
