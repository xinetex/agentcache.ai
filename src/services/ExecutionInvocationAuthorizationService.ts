export interface InvocationReadinessRun {
  status?: string | null;
  gateStatus?: string | null;
  requiredReviewerRoles?: string[] | null;
  completedReviewerRoles?: string[] | null;
  reviewVerdict?: string | null;
}

export type InvocationReadiness =
  | { allowed: true }
  | { allowed: false; reason: 'required_review_incomplete' | 'run_requires_approval_or_is_blocked'; pendingReviewerRoles: string[] };

export function evaluateExecutionInvocationReadiness(run: InvocationReadinessRun): InvocationReadiness {
  const requiredReviewerRoles = Array.isArray(run.requiredReviewerRoles) ? run.requiredReviewerRoles : [];
  const completedReviewerRoles = Array.isArray(run.completedReviewerRoles) ? run.completedReviewerRoles : [];
  const pendingReviewerRoles = requiredReviewerRoles.filter((role) => !completedReviewerRoles.includes(role));
  if (pendingReviewerRoles.length > 0 || (requiredReviewerRoles.length > 0 && run.reviewVerdict !== 'PASS')) {
    return { allowed: false, reason: 'required_review_incomplete', pendingReviewerRoles };
  }
  if (run.status === 'blocked' || run.gateStatus === 'pending' || run.gateStatus === 'rejected') {
    return { allowed: false, reason: 'run_requires_approval_or_is_blocked', pendingReviewerRoles: [] };
  }
  return { allowed: true };
}
