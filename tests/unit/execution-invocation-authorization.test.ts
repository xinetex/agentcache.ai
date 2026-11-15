import { describe, expect, it } from 'vitest';
import { evaluateExecutionInvocationReadiness } from '../../src/services/ExecutionInvocationAuthorizationService.js';

describe('execution invocation readiness', () => {
  it('denies provider access when required reviewers have not passed, even without an approval gate', () => {
    expect(evaluateExecutionInvocationReadiness({
      status: 'awaiting_review', gateStatus: 'not_required',
      requiredReviewerRoles: ['critical'], completedReviewerRoles: [], reviewVerdict: 'INFO',
    })).toEqual({
      allowed: false, reason: 'required_review_incomplete', pendingReviewerRoles: ['critical'],
    });
  });

  it('allows access after every required reviewer passes and the gate is clear', () => {
    expect(evaluateExecutionInvocationReadiness({
      status: 'completed', gateStatus: 'approved',
      requiredReviewerRoles: ['critical', 'compliance'],
      completedReviewerRoles: ['critical', 'compliance'], reviewVerdict: 'PASS',
    })).toEqual({ allowed: true });
  });

  it('still denies an unresolved gate or blocked run when no reviewer roles are configured', () => {
    expect(evaluateExecutionInvocationReadiness({ status: 'in_progress', gateStatus: 'pending' })).toMatchObject({
      allowed: false, reason: 'run_requires_approval_or_is_blocked',
    });
    expect(evaluateExecutionInvocationReadiness({ status: 'blocked', gateStatus: 'not_required' })).toMatchObject({
      allowed: false, reason: 'run_requires_approval_or_is_blocked',
    });
  });
});
