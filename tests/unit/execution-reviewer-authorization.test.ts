import { describe, expect, it } from 'vitest';
import { ExecutionReviewerAuthorizationService, ReviewAssignmentConflict } from '../../src/services/ExecutionReviewerAuthorizationService.js';

function fakeDatabase(role: string | null) {
  return {
    select() {
      const query: any = {
        from() { return query; },
        where() { return query; },
        then(resolve: (rows: any[]) => void) { resolve(role ? [{ role }] : []); },
      };
      return query;
    },
  };
}

function matchesWhere(row: any, expr: any): boolean {
  if (!expr?.queryChunks) return true;
  const nested = expr.queryChunks.filter((chunk: any) => chunk?.queryChunks);
  if (nested.length) return nested.every((condition: any) => matchesWhere(row, condition));
  const [, column, operatorChunk, rawValue] = expr.queryChunks;
  const key = column?.name;
  const operator = operatorChunk?.value?.[0]?.trim();
  const value = rawValue?.value ?? rawValue;
  if (operator === '=' && key) {
    const camel = key.replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase());
    return row[key] === value || row[camel] === value;
  }
  return true;
}

function fakeAssignmentDatabase() {
  const assignments: any[] = [];
  return {
    assignments,
    insert() {
      let value: any;
      return {
        values(input: any) { value = input; return this; },
        onConflictDoNothing() { return this; },
        async returning() {
          const exists = assignments.some((row) => row.executionRunId === value.executionRunId && row.reviewerPrincipalId === value.reviewerPrincipalId);
          if (exists) return [];
          assignments.push(value);
          return [value];
        },
      };
    },
    select() {
      let tableRows: any[] = [];
      let condition: any;
      return {
        from() { tableRows = assignments; return this; },
        where(input: any) { condition = input; return this; },
        then(resolve: (rows: any[]) => void) { resolve(tableRows.filter((row) => matchesWhere(row, condition))); },
      };
    },
  };
}

const validReview = {
  run: { orgId: 'org-1', createdByActorPrincipalId: 'user:creator' },
  reviewerPrincipalId: 'user:reviewer',
  reviewerUserId: 'reviewer',
  organizationId: 'org-1',
};

describe('execution reviewer authorization', () => {
  it('allows a distinct individual member of the run organization', async () => {
    const authorization = new ExecutionReviewerAuthorizationService(fakeDatabase('member'));
    await expect(authorization.authorize(validReview)).resolves.toEqual({ allowed: true });
  });

  it('rejects shared credentials without an individual user identity', async () => {
    const authorization = new ExecutionReviewerAuthorizationService(fakeDatabase('admin'));
    await expect(authorization.authorize({ ...validReview, reviewerUserId: null }))
      .resolves.toMatchObject({ allowed: false, reason: 'missing_individual_identity' });
  });

  it('rejects the run creator and reviewers from another organization', async () => {
    const authorization = new ExecutionReviewerAuthorizationService(fakeDatabase('admin'));
    await expect(authorization.authorize({ ...validReview, reviewerPrincipalId: 'user:creator' }))
      .resolves.toMatchObject({ allowed: false, reason: 'owner_cannot_review' });
    await expect(authorization.authorize({ ...validReview, organizationId: 'org-2' }))
      .resolves.toMatchObject({ allowed: false, reason: 'different_organization_required' });
    await expect(authorization.authorize({ ...validReview, run: { orgId: 'org-1' } }))
      .resolves.toMatchObject({ allowed: false, reason: 'owner_identity_unavailable' });
  });

  it('rejects viewers and identities that are not organization members', async () => {
    const viewerAuthorization = new ExecutionReviewerAuthorizationService(fakeDatabase('viewer'));
    await expect(viewerAuthorization.authorize(validReview))
      .resolves.toMatchObject({ allowed: false, reason: 'organization_membership_required' });
    const missingAuthorization = new ExecutionReviewerAuthorizationService(fakeDatabase(null));
    await expect(missingAuthorization.authorize(validReview))
      .resolves.toMatchObject({ allowed: false, reason: 'organization_membership_required' });
  });

  it('serializes role claims and prevents one identity from claiming multiple roles', async () => {
    const database = fakeAssignmentDatabase();
    const authorization = new ExecutionReviewerAuthorizationService(database);
    const first = await authorization.claimRole({ executionRunId: 'run-1', reviewerPrincipalId: 'user:a', reviewerRole: 'critical' });
    expect(first.claimed).toBe(true);
    await expect(authorization.claimRole({ executionRunId: 'run-1', reviewerPrincipalId: 'user:a', reviewerRole: 'compliance' }))
      .rejects.toBeInstanceOf(ReviewAssignmentConflict);
    await expect(authorization.claimRole({ executionRunId: 'run-1', reviewerPrincipalId: 'user:b', reviewerRole: 'critical' }))
      .resolves.toMatchObject({ claimed: true });
    await expect(authorization.claimRole({ executionRunId: 'run-1', reviewerPrincipalId: 'user:a', reviewerRole: 'critical' }))
      .resolves.toMatchObject({ claimed: false, existing: true });

    const concurrent = await Promise.allSettled([
      authorization.claimRole({ executionRunId: 'run-2', reviewerPrincipalId: 'user:c', reviewerRole: 'critical' }),
      authorization.claimRole({ executionRunId: 'run-2', reviewerPrincipalId: 'user:c', reviewerRole: 'compliance' }),
    ]);
    expect(concurrent.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(concurrent.filter((result) => result.status === 'rejected')).toHaveLength(1);
  });
});
