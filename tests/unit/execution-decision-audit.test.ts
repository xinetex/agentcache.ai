import { describe, expect, it } from 'vitest';
import { ExecutionDecisionAuditService } from '../../src/services/ExecutionDecisionAuditService.js';

function createDatabase() {
  const rows: any[] = [];
  return {
    rows,
    insert: () => ({
      values: (event: any) => ({ returning: async () => { rows.push(event); return [event]; } }),
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({ limit: async () => rows }),
        }),
      }),
    }),
  };
}

describe('ExecutionDecisionAuditService', () => {
  it('records minimal decision metadata and returns only events owned by the principal', async () => {
    const database = createDatabase();
    const service = new ExecutionDecisionAuditService(database);
    await service.record({
      eventType: 'run_started', executionRunId: 'run_1', contextPackId: 'pack_1',
      contextPackVersionId: 'version_1', ownerPrincipalId: 'owner_1', actorPrincipalId: 'owner_1',
      organizationId: null, actorRole: 'workflow_owner', verdict: null, status: 'in_progress',
      summary: null, findings: [], confidence: null, phase: 'draft', receiptId: 'receipt_1',
    });
    await service.record({
      eventType: 'gate_decided', executionRunId: 'run_1', contextPackId: 'pack_1',
      contextPackVersionId: 'version_1', ownerPrincipalId: 'owner_2', actorPrincipalId: 'admin_1',
      organizationId: null, actorRole: 'administrator', verdict: 'PASS', status: 'completed',
      summary: 'Reviewed jane@example.com with Bearer abc.def.ghi', findings: ['SSN 123-45-6789'], confidence: 0.9,
      phase: 'completed', receiptId: 'receipt_2',
    });

    const history = await service.listForRun('run_1', 'owner_1');
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ eventType: 'run_started', actorPrincipalId: 'owner_1' });
    expect(database.rows[0]).not.toHaveProperty('inputPayload');
    expect(database.rows[0]).not.toHaveProperty('outputPayload');
    expect(database.rows[1].summary).not.toMatch(/jane@example.com|Bearer abc/);
    expect(database.rows[1].findings[0]).not.toContain('123-45-6789');
  });
});
