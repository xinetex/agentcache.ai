import { describe, expect, it } from 'vitest';
import { ExecutionGateApprovalAuthorizationService } from '../../src/services/ExecutionGateApprovalAuthorizationService.js';

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

const organizationId = 'org-1';
const creatorUserId = 'creator';
const adminUserId = 'admin';
const run = { orgId: organizationId, createdByActorPrincipalId: `user:${creatorUserId}` };

describe('ExecutionGateApprovalAuthorizationService', () => {
  it('requires a distinct individual owner or administrator in the run organization', async () => {
    const adminAuthorization = new ExecutionGateApprovalAuthorizationService(fakeDatabase('admin'));
    const memberAuthorization = new ExecutionGateApprovalAuthorizationService(fakeDatabase('member'));

    await expect(adminAuthorization.authorize({
      run, approverPrincipalId: `user:${creatorUserId}`, approverUserId: creatorUserId, organizationId,
    })).resolves.toEqual({ allowed: false, reason: 'owner_cannot_approve' });
    await expect(memberAuthorization.authorize({
      run, approverPrincipalId: 'user:member', approverUserId: 'member', organizationId,
    })).resolves.toEqual({ allowed: false, reason: 'organization_admin_required' });
    await expect(adminAuthorization.authorize({
      run, approverPrincipalId: `user:${adminUserId}`, approverUserId: adminUserId, organizationId: 'org-2',
    })).resolves.toEqual({ allowed: false, reason: 'same_organization_required' });
    await expect(adminAuthorization.authorize({
      run, approverPrincipalId: `user:${adminUserId}`, approverUserId: adminUserId, organizationId,
    })).resolves.toEqual({ allowed: true, actorRole: 'admin' });

    const ownerAuthorization = new ExecutionGateApprovalAuthorizationService(fakeDatabase('owner'));
    await expect(ownerAuthorization.authorize({
      run, approverPrincipalId: 'user:owner', approverUserId: 'owner', organizationId,
    })).resolves.toEqual({ allowed: true, actorRole: 'owner' });
  });

  it('rejects organization-only credentials without an individual user identity', async () => {
    const authorization = new ExecutionGateApprovalAuthorizationService(fakeDatabase('admin'));
    await expect(authorization.authorize({
      run, approverPrincipalId: 'org:approver', organizationId,
    })).resolves.toMatchObject({ allowed: false, reason: 'missing_individual_identity' });
  });
});
