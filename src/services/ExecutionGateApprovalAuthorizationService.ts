import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { members } from '../db/schema.js';

export type GateApprovalAuthorizationResult =
  | { allowed: true; actorRole: 'owner' | 'admin' }
  | { allowed: false; reason: 'missing_individual_identity' | 'same_organization_required' | 'owner_cannot_approve' | 'organization_admin_required' };

export class ExecutionGateApprovalAuthorizationService {
  constructor(private readonly database: any = db) {}

  async authorize(input: {
    run: { orgId?: string | null; createdByActorPrincipalId?: string | null };
    approverPrincipalId?: string | null;
    approverUserId?: string | null;
    organizationId?: string | null;
  }): Promise<GateApprovalAuthorizationResult> {
    if (!input.approverPrincipalId || !input.approverUserId) {
      return { allowed: false, reason: 'missing_individual_identity' };
    }
    if (!input.run.orgId || input.run.orgId !== input.organizationId) {
      return { allowed: false, reason: 'same_organization_required' };
    }
    if (!input.run.createdByActorPrincipalId) {
      return { allowed: false, reason: 'missing_individual_identity' };
    }
    if (input.run.createdByActorPrincipalId === input.approverPrincipalId) {
      return { allowed: false, reason: 'owner_cannot_approve' };
    }

    const rows = await this.database.select({ role: members.role })
      .from(members)
      .where(and(eq(members.orgId, input.organizationId), eq(members.userId, input.approverUserId)));
    const actorRole = (rows as Array<{ role?: string | null }>)
      .map((row) => String(row.role || '').toLowerCase())
      .find((role): role is 'owner' | 'admin' => role === 'owner' || role === 'admin');
    if (!actorRole) return { allowed: false, reason: 'organization_admin_required' };
    return { allowed: true, actorRole };
  }
}

export const executionGateApprovalAuthorizationService = new ExecutionGateApprovalAuthorizationService();
