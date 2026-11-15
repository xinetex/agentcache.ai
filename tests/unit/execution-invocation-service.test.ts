import { describe, expect, it } from 'vitest';
import { executionInvocationService, ExecutionInvocationService, summarizeExecutionUsage } from '../../src/services/ExecutionInvocationService.js';

describe('ExecutionInvocationService', () => {
  it('keeps durable invocation records redacted and marks completion', async () => {
    const started = await executionInvocationService.start({
      executionRunId: 'run_audit_test',
      contextPackVersionId: 'ctxv_policy_v4',
      runReceiptId: 'receipt_run_audit_test',
      approvalGateId: 'gate_audit_test',
      approvalReceiptId: 'receipt_gate_audit_test',
      principalId: 'principal:audit-test',
      actorPrincipalId: 'user:operator-audit-test',
      connectionId: null,
      toolName: 'jetty.storage.summary',
      inputSummary: { operation: 'aggregate_storage_summary' },
    });
    const completed = await executionInvocationService.finish(started.id, {
      status: 'completed',
      resultSummary: { quotaBytes: 1000, usedBytes: 400, remainingBytes: 600, fileCount: 4 },
    });

    expect(started.id).toBeTruthy();
    expect(completed?.status).toBe('completed');
    expect(completed?.contextPackVersionId).toBe('ctxv_policy_v4');
    expect(completed?.runReceiptId).toBe('receipt_run_audit_test');
    expect(completed?.approvalGateId).toBe('gate_audit_test');
    expect(completed?.approvalReceiptId).toBe('receipt_gate_audit_test');
    expect(completed?.actorPrincipalId).toBe('user:operator-audit-test');
    expect(completed?.resultSummary).toEqual({ quotaBytes: 1000, usedBytes: 400, remainingBytes: 600, fileCount: 4 });
    expect(JSON.stringify(completed)).not.toMatch(/serviceKey|accessToken|fileName|storageKey/);
  });

  it('does not allow a terminal invocation outcome to be overwritten', async () => {
    const service = new ExecutionInvocationService();
    const started = await service.start({
      executionRunId: 'run_terminal_state_test',
      principalId: 'principal:terminal-state-test',
      toolName: 'jetty.storage.summary',
    });
    const completed = await service.finish(started.id, {
      status: 'completed',
      resultSummary: { fileCount: 2 },
    });
    const lateFailure = await service.finish(started.id, {
      status: 'error',
      errorCode: 'provider_request_failed',
    });

    expect(completed?.status).toBe('completed');
    expect(lateFailure).toBeNull();
    expect((await service.listOwned('run_terminal_state_test', 'principal:terminal-state-test'))[0]?.status).toBe('completed');
  });

  it('reuses a durable invocation for the same idempotency key and rejects a different request', async () => {
    const service = new ExecutionInvocationService();
    const input = {
      executionRunId: 'run_idempotency_test',
      principalId: 'principal:idempotency-test',
      toolName: 'jetty.storage.summary',
      idempotencyKeyHash: 'a'.repeat(64),
      requestHash: 'b'.repeat(64),
    };
    const first = await service.startIdempotent(input);
    const retry = await service.startIdempotent(input);

    expect(first.duplicate).toBe(false);
    expect(retry.duplicate).toBe(true);
    expect(retry.invocation.id).toBe(first.invocation.id);
    await expect(service.startIdempotent({ ...input, requestHash: 'c'.repeat(64) }))
      .rejects.toThrow('execution_idempotency_conflict');
  });

  it('records denials with no provider payload', async () => {
    const blocked = await executionInvocationService.record({
      executionRunId: 'run_audit_test',
      principalId: 'principal:audit-test',
      actorPrincipalId: 'user:policy-reviewer',
      toolName: 'jetty.storage.summary',
      status: 'blocked',
      policyDecision: 'denied',
      errorCode: 'policy_denied',
      inputSummary: { operation: 'aggregate_storage_summary' },
    });
    expect(blocked.status).toBe('blocked');
    expect(blocked.policyDecision).toBe('denied');
    expect(blocked.actorPrincipalId).toBe('user:policy-reviewer');
    expect(blocked.resultSummary).toBeNull();
  });

  it('filters durable history to the authenticated principal', async () => {
    await executionInvocationService.record({
      executionRunId: 'run_shared_audit_test', principalId: 'principal:owner',
      toolName: 'jetty.storage.summary', status: 'blocked', errorCode: 'policy_denied',
    });
    await executionInvocationService.record({
      executionRunId: 'run_shared_audit_test', principalId: 'principal:other',
      toolName: 'jetty.storage.summary', status: 'blocked', errorCode: 'policy_denied',
    });
    const records = await executionInvocationService.listOwned('run_shared_audit_test', 'principal:owner');
    expect(records).toHaveLength(1);
    expect(records[0].principalId).toBe('principal:owner');
  });

  it('counts completed calls as the only candidate billable units', () => {
    const usage = summarizeExecutionUsage([
      { toolName: 'jetty.storage.summary', status: 'completed', count: '3' },
      { toolName: 'jetty.storage.summary', status: 'blocked', count: 2 },
      { toolName: 'jetty.storage.summary', status: 'error', count: 1 },
      { toolName: 'jetty.storage.summary', status: 'started', count: 1 },
      { toolName: 'jetty.storage.summary', status: 'outcome_unknown', count: 2 },
    ], { now: new Date('2026-11-15T12:00:00.000Z'), scope: 'organization' });
    expect(usage.periodStart).toBe('2026-11-01T00:00:00.000Z');
    expect(usage.totals).toEqual({ completed: 3, blocked: 2, error: 1, incomplete: 3 });
    expect(usage.billableActionCount).toBe(3);
    expect(usage.deniedActionsBillable).toBe(false);
    expect(usage.rateUsd).toBeNull();
    expect(usage.adoption).toEqual({ completedRunCount: 0, repeatedWorkflowVersionCount: 0, repeatedCompletedRunCount: 0, activeWeeks: 0 });
  });

  it('queries grouped monthly counts from the durable invocation ledger', async () => {
    const queryFor = (result: any[]) => ({
      from() { return this; },
      where() { return this; },
      groupBy() { return Promise.resolve(result); },
      then(resolve: (value: any[]) => unknown, reject: (error: unknown) => unknown) {
        return Promise.resolve(result).then(resolve, reject);
      },
    });
    const database = {
      select(shape: Record<string, unknown>) {
        if ('toolName' in shape) return queryFor([
        { toolName: 'jetty.storage.summary', status: 'completed', count: 2 },
        { toolName: 'jetty.storage.summary', status: 'blocked', count: 1 },
        ]);
        if ('contextPackVersionId' in shape) return queryFor([
          { contextPackVersionId: 'ctxv_pilot', completedRuns: 2 },
          { contextPackVersionId: 'ctxv_single', completedRuns: 1 },
        ]);
        return queryFor([{ activeWeeks: 2 }]);
      },
    };
    const service = new ExecutionInvocationService(database);
    const usage = await service.getMonthlyUsage('principal:usage-test', null, new Date('2026-11-15T12:00:00.000Z'));
    expect(usage.scope).toBe('principal');
    expect(usage.billableActionCount).toBe(2);
    expect(usage.totals.blocked).toBe(1);
    expect(usage.adoption).toEqual({ completedRunCount: 3, repeatedWorkflowVersionCount: 1, repeatedCompletedRunCount: 2, activeWeeks: 2 });
  });
});
