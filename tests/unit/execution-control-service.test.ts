import { beforeEach, describe, expect, it } from 'vitest';
import { redis } from '../../src/lib/redis.js';
import { executionControlService } from '../../src/services/ExecutionControlService.js';
import { executionDecisionAuditService } from '../../src/services/ExecutionDecisionAuditService.js';

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
      inputPayload: { documentId: 'doc-001', ownerEmail: 'person@example.com', accessToken: 'Bearer ac_test_sensitive-credential-value' },
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
      actorRole: 'admin',
      decidedBy: 'admin:test',
      decidedByPrincipalId: 'user:admin-test',
      note: 'Approved for external release.',
    });

    expect(decided.run.status).toBe('completed');
    expect(decided.gate.status).toBe('approved');
    expect(decided.receipt.refs.decidedByRole).toBe('admin');
    const decisionEvents = await executionDecisionAuditService.listForRun(started.run.id, 'org:test');
    expect(decisionEvents.find((event) => event.eventType === 'gate_decided')).toMatchObject({
      actorPrincipalId: 'user:admin-test', actorRole: 'admin', verdict: 'PASS',
    });

    const bundle = await executionControlService.getRunBundle(started.run.id);
    expect(bundle?.reviews).toHaveLength(2);
    expect(bundle?.gate?.decisionNote).toContain('Approved');

    const cacheKeys = await redis.keys('execution:*');
    for (const key of cacheKeys) await redis.del(key);
    const recovered = await executionControlService.getRunBundle(started.run.id);
    expect(recovered?.run.status).toBe('completed');
    expect(recovered?.reviews).toHaveLength(2);
    expect(recovered?.reviews[0].summary).toBe('No blocking issues found.');
    expect(recovered?.gate?.status).toBe('approved');
    expect(recovered?.run.inputPayload.ownerEmail).toBe('[REDACTED EMAIL]');
    expect(recovered?.run.inputPayload.accessToken).toBe('[REDACTED]');
    expect((await executionControlService.listRuns(10, 'org:test')).some((run) => run.id === started.run.id)).toBe(true);
    expect((await executionControlService.listContextPacks(10, 'org:test')).some((pack) => pack.id === created.pack.id)).toBe(true);
  });

  it('keeps REVIEW verdicts at the review phase until a reviewer resolves them with PASS', async () => {
    const created = await executionControlService.createContextPack({
      name: 'Finance review resolution',
      objective: 'Review a finance report before release.',
      sectorHint: 'finance',
      reviewerRoles: ['critical'],
      workflowPhases: ['draft', 'review', 'gate', 'finalize'],
    }, { principalId: 'org:review-resolution' });
    const started = await executionControlService.startRun({
      contextPackId: created.pack.id,
      finalAction: 'manual',
    }, { principalId: 'org:review-resolution' });

    await executionControlService.advancePhase({ runId: started.run.id, phase: 'review' });
    const reviewNeeded = await executionControlService.recordReview({
      runId: started.run.id,
      reviewerRole: 'critical',
      verdict: 'REVIEW',
      summary: 'Clarify an unsupported figure before approval.',
    });
    expect(reviewNeeded.run.currentPhase).toBe('review');
    expect(reviewNeeded.run.completedReviewerRoles).toEqual([]);
    await expect(executionControlService.advancePhase({ runId: started.run.id, phase: 'gate' }))
      .rejects.toThrow('PASS review verdict');
    await expect(executionControlService.decideGate({
      gateId: started.gate!.id, decision: 'approved', decidedBy: 'admin:test',
    })).rejects.toThrow('PASS review verdict');

    const resolved = await executionControlService.recordReview({
      runId: started.run.id,
      reviewerRole: 'critical',
      verdict: 'PASS',
      summary: 'The figure was verified against the source report.',
    });
    expect(resolved.run.reviewVerdict).toBe('PASS');
    expect(resolved.run.completedReviewerRoles).toEqual(['critical']);
    expect(resolved.run.currentPhase).toBe('gate');

    const approved = await executionControlService.decideGate({
      gateId: started.gate!.id,
      decision: 'approved',
      decidedBy: 'admin:test',
    });
    expect(approved.run.status).toBe('completed');
  });

  it('allows only one concurrent administrator decision to win a gate', async () => {
    const created = await executionControlService.createContextPack({
      name: 'Concurrent gate decision',
      objective: 'Review the release request before approval.',
      sectorHint: 'finance', reviewerRoles: ['critical'],
      workflowPhases: ['draft', 'review', 'gate', 'finalize'],
    }, { principalId: 'org:concurrent-gate' });
    const started = await executionControlService.startRun({
      contextPackId: created.pack.id, finalAction: 'publish',
    }, { principalId: 'org:concurrent-gate' });
    await executionControlService.advancePhase({ runId: started.run.id, phase: 'review' });
    await executionControlService.recordReview({
      runId: started.run.id, reviewerPrincipalId: 'user:gate-reviewer', reviewerRole: 'critical',
      verdict: 'PASS', summary: 'Review passed.',
    });

    const decisions = await Promise.allSettled([
      executionControlService.decideGate({ gateId: started.gate!.id, decision: 'approved', decidedBy: 'approver-a' }),
      executionControlService.decideGate({ gateId: started.gate!.id, decision: 'rejected', decidedBy: 'approver-b' }),
    ]);
    expect(decisions.filter((decision) => decision.status === 'fulfilled')).toHaveLength(1);
    expect(decisions.filter((decision) => decision.status === 'rejected')).toHaveLength(1);

    const recovered = await executionControlService.getRunBundle(started.run.id);
    expect(recovered?.gate?.status).toMatch(/approved|rejected/);
    expect(recovered?.run.gateStatus).toBe(recovered?.gate?.status);
    expect(recovered?.run.status).toBe(recovered?.gate?.status === 'approved' ? 'completed' : 'blocked');
  });

  it('requires distinct reviewer identities across required roles', async () => {
    const created = await executionControlService.createContextPack({
      name: 'Distinct review roles',
      objective: 'Require two separate reviewers before release.',
      reviewerRoles: ['critical', 'compliance'],
      workflowPhases: ['draft', 'review', 'gate'],
    }, { principalId: 'org:distinct-review' });
    const started = await executionControlService.startRun({
      contextPackId: created.pack.id,
      finalAction: 'manual',
    }, { principalId: 'org:distinct-review', actorPrincipalId: 'user:creator' });
    await executionControlService.advancePhase({ runId: started.run.id, phase: 'review' });

    await executionControlService.recordReview({
      runId: started.run.id, reviewerPrincipalId: 'user:reviewer-a', reviewerRole: 'critical', verdict: 'PASS',
    });
    await expect(executionControlService.recordReview({
      runId: started.run.id, reviewerPrincipalId: 'user:reviewer-a', reviewerRole: 'compliance', verdict: 'PASS',
    })).rejects.toThrow('A reviewer cannot fill multiple reviewer roles');
    await expect(executionControlService.recordReview({
      runId: started.run.id, reviewerPrincipalId: 'user:creator', reviewerRole: 'compliance', verdict: 'PASS',
    })).rejects.toThrow('workflow owner cannot review');
    const complete = await executionControlService.recordReview({
      runId: started.run.id, reviewerPrincipalId: 'user:reviewer-b', reviewerRole: 'compliance', verdict: 'PASS',
    });
    expect(complete.run.completedReviewerRoles).toEqual(['critical', 'compliance']);
  });

  it('lets a read-only workflow use an approval gate without requiring a separate reviewer', async () => {
    const created = await executionControlService.createContextPack({
      name: 'Read-only storage summary',
      objective: 'Read aggregate storage quota and file count.',
      sectorHint: 'general',
      tools: ['jetty.storage.summary'],
      reviewerRoles: [],
      workflowPhases: ['draft', 'review', 'gate', 'finalize'],
    }, { principalId: 'org:read-only-summary' });

    expect(created.version.reviewerRoles).toEqual([]);

    const started = await executionControlService.startRun({
      contextPackId: created.pack.id,
      finalAction: 'manual',
      requireHumanGate: true,
    }, { principalId: 'org:read-only-summary' });

    expect(started.run.requiredReviewerRoles).toEqual([]);
    expect(started.run.phasePlan).toEqual(['draft', 'gate', 'finalize']);
    expect(started.run.reviewVerdict).toBe('INFO');

    const atGate = await executionControlService.advancePhase({ runId: started.run.id, phase: 'gate' });
    expect(atGate.status).toBe('awaiting_gate');
    expect(atGate.currentPhase).toBe('gate');

    const approved = await executionControlService.decideGate({
      gateId: started.gate!.id,
      decision: 'approved',
      decidedBy: 'admin:read-only-pilot',
      note: 'Approved read-only aggregate access.',
    });
    expect(approved.run.status).toBe('completed');
    expect(approved.run.reviewVerdict).toBe('INFO');

    const ungated = await executionControlService.startRun({
      contextPackId: created.pack.id,
      finalAction: 'manual',
      requireHumanGate: false,
    }, { principalId: 'org:read-only-summary' });
    expect(ungated.run.gateStatus).toBe('not_required');
    expect(ungated.run.phasePlan).toEqual(['draft', 'finalize']);

    const defaultReviewPack = await executionControlService.createContextPack({
      name: 'Default review workflow', objective: 'Keep the existing default review behavior.', sectorHint: 'general',
    }, { principalId: 'org:read-only-summary' });
    expect(defaultReviewPack.version.reviewerRoles).toEqual(['critical']);

    const auditPack = await executionControlService.createContextPack({
      name: 'Audit workflow defaults', objective: 'Retain required reviewers for audit policy.',
      sectorHint: 'finance', reviewerRoles: [],
    }, { principalId: 'org:read-only-summary' });
    expect(auditPack.version.reviewerRoles).toEqual(['critical', 'compliance']);
  });
});
