import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { executionReviewAssignments, members } from '../db/schema.js';
import { executionRecordExpiresAt } from './ExecutionRetentionPolicy.js';

export type ReviewAuthorizationResult =
  | { allowed: true }
  | { allowed: false; reason: 'missing_individual_identity' | 'different_organization_required' | 'owner_identity_unavailable' | 'owner_cannot_review' | 'organization_membership_required' };

export class ReviewAssignmentConflict extends Error {
  constructor(readonly reason: 'reviewer_already_used_for_another_role' | 'review_assignment_conflict') {
    super(reason);
    this.name = 'ReviewAssignmentConflict';
  }
}

export class ExecutionReviewerAuthorizationService {
  constructor(private readonly database: any = db) {}

  async authorize(input: {
    run: { orgId?: string | null; createdByActorPrincipalId?: string | null };
    reviewerPrincipalId?: string | null;
    reviewerUserId?: string | null;
    organizationId?: string | null;
  }): Promise<ReviewAuthorizationResult> {
    if (!input.reviewerUserId || !input.reviewerPrincipalId) {
      return { allowed: false, reason: 'missing_individual_identity' };
    }
    if (!input.run.orgId || !input.organizationId || input.run.orgId !== input.organizationId) {
      return { allowed: false, reason: 'different_organization_required' };
    }
    if (!input.run.createdByActorPrincipalId) {
      return { allowed: false, reason: 'owner_identity_unavailable' };
    }
    if (input.run.createdByActorPrincipalId === input.reviewerPrincipalId) {
      return { allowed: false, reason: 'owner_cannot_review' };
    }

    const rows = await this.database.select({ role: members.role })
      .from(members)
      .where(and(eq(members.orgId, input.organizationId), eq(members.userId, input.reviewerUserId)));
    const membership = (rows as Array<{ role?: string | null }>).find((row) => ['owner', 'admin', 'member'].includes(String(row.role || '').toLowerCase()));
    if (!membership) return { allowed: false, reason: 'organization_membership_required' };
    return { allowed: true };
  }

  /** Claim one workflow role per individual reviewer. The composite database
   * primary key serializes competing requests across processes and instances. */
  async claimRole(input: { executionRunId: string; reviewerPrincipalId: string; reviewerRole: string }) {
    const now = new Date();
    const rows = await this.database.insert(executionReviewAssignments).values({
      executionRunId: input.executionRunId,
      reviewerPrincipalId: input.reviewerPrincipalId,
      reviewerRole: input.reviewerRole,
      createdAt: now,
      expiresAt: executionRecordExpiresAt(now),
    }).onConflictDoNothing().returning();
    if (rows[0]) return { claimed: true };

    const existing = await this.database.select().from(executionReviewAssignments)
      .where(and(
        eq(executionReviewAssignments.executionRunId, input.executionRunId),
        eq(executionReviewAssignments.reviewerPrincipalId, input.reviewerPrincipalId),
      ));
    const assignment = (existing as Array<{ reviewerRole: string; expiresAt?: Date | string }>).find(
      (row) => !row.expiresAt || new Date(row.expiresAt).getTime() > now.getTime(),
    );
    if (assignment?.reviewerRole === input.reviewerRole) return { claimed: false, existing: true };
    if (assignment) throw new ReviewAssignmentConflict('reviewer_already_used_for_another_role');
    throw new ReviewAssignmentConflict('review_assignment_conflict');
  }

  async releaseRoleClaim(input: { executionRunId: string; reviewerPrincipalId: string; reviewerRole: string }) {
    const rows = await this.database.delete(executionReviewAssignments).where(and(
      eq(executionReviewAssignments.executionRunId, input.executionRunId),
      eq(executionReviewAssignments.reviewerPrincipalId, input.reviewerPrincipalId),
      eq(executionReviewAssignments.reviewerRole, input.reviewerRole),
    )).returning();
    return rows.length > 0;
  }
}

export const executionReviewerAuthorizationService = new ExecutionReviewerAuthorizationService();
