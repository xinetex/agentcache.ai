import { afterEach, describe, expect, it } from 'vitest';
import { executionRecordExpiresAt, getExecutionRetentionDays } from '../../src/services/ExecutionRetentionPolicy.js';
import { ExecutionRetentionService } from '../../src/services/ExecutionRetentionService.js';
import retentionCron from '../../api/cron/execution-retention.js';

const priorRetention = process.env.AGENTCACHE_EXECUTION_AUDIT_RETENTION_DAYS;

afterEach(() => {
  if (priorRetention === undefined) delete process.env.AGENTCACHE_EXECUTION_AUDIT_RETENTION_DAYS;
  else process.env.AGENTCACHE_EXECUTION_AUDIT_RETENTION_DAYS = priorRetention;
});

describe('execution retention', () => {
  it('uses a bounded default and honors configured retention within bounds', () => {
    delete process.env.AGENTCACHE_EXECUTION_AUDIT_RETENTION_DAYS;
    expect(getExecutionRetentionDays()).toBe(365);
    process.env.AGENTCACHE_EXECUTION_AUDIT_RETENTION_DAYS = '180';
    expect(getExecutionRetentionDays()).toBe(180);
    expect(executionRecordExpiresAt(new Date('2026-01-01T00:00:00.000Z')).toISOString())
      .toBe('2026-06-30T00:00:00.000Z');
    process.env.AGENTCACHE_EXECUTION_AUDIT_RETENTION_DAYS = '30';
    expect(getExecutionRetentionDays()).toBe(365);
  });

  it('purges expired invocation, decision, and workflow records with counts', async () => {
    const queries: any[] = [];
    const database = {
      __isMock: false,
      async execute(query: any) {
        queries.push(query);
        return [{ id: 'purged' }];
      },
    };
    const service = new ExecutionRetentionService(database);
    const result = await service.purgeExpired(new Date('2026-11-15T00:00:00.000Z'));
    expect(result.total).toBe(4);
    expect(result.outcomeUnknown).toBe(1);
    expect(result.purged).toEqual({ invocations: 1, decisions: 1, workflowRecords: 1, reviewerAssignments: 1 });
    expect(queries).toHaveLength(5);
    const deletedTables = queries.flatMap((query) => query.queryChunks
      .filter((chunk: any) => chunk?.constructor?.name === 'Name')
      .map((chunk: any) => chunk.value));
    expect(new Set(deletedTables)).toEqual(new Set([
      'execution_invocations', 'execution_decision_events', 'execution_control_records', 'execution_review_assignments',
    ]));
  });

  it('runs the stale-call reconciliation pass before cleanup even when no calls are stale', async () => {
    const queries: any[] = [];
    const database = {
      __isMock: false,
      async execute(query: any) {
        queries.push(query);
        return [];
      },
    };
    const result = await new ExecutionRetentionService(database).purgeExpired(new Date('2026-11-15T00:15:00.000Z'));
    expect(result.outcomeUnknown).toBe(0);
    expect(queries).toHaveLength(5);
  });

  it('skips deletion when the database is a mock', async () => {
    const service = new ExecutionRetentionService({ __isMock: true });
    const result = await service.purgeExpired();
    expect(result).toMatchObject({ skipped: true, reason: 'mock_database' });
  });

  it('protects the scheduled cleanup endpoint with CRON_SECRET', async () => {
    const priorSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = 'retention-cron-test-secret';
    const response: any = { statusCode: 200, status(code: number) { this.statusCode = code; return this; }, json(body: any) { this.body = body; return this; } };
    await retentionCron({ headers: { authorization: 'Bearer wrong' } }, response);
    expect(response.statusCode).toBe(401);
    await retentionCron({ headers: { authorization: 'Bearer retention-cron-test-secret' } }, response);
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({ success: true, skipped: true, reason: 'mock_database' });
    if (priorSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = priorSecret;
  });
});
