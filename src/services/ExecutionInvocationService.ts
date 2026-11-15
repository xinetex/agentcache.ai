import { and, desc, eq, gte, isNotNull, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db } from '../db/client.js';
import { executionInvocations } from '../db/schema.js';
import { executionRecordExpiresAt } from './ExecutionRetentionPolicy.js';

export type InvocationStatus = 'started' | 'completed' | 'blocked' | 'error' | 'outcome_unknown';
export interface ExecutionInvocationRecord {
  id: string;
  executionRunId: string;
  contextPackVersionId: string | null;
  runReceiptId: string | null;
  approvalGateId: string | null;
  approvalReceiptId: string | null;
  principalId: string;
  actorPrincipalId: string | null;
  orgId: string | null;
  connectionId: string | null;
  toolName: string;
  policyVersion?: string | null;
  policyRuleIds?: string[];
  policyReasonCode?: string | null;
  policyScore?: number | null;
  idempotencyKeyHash?: string | null;
  requestHash?: string | null;
  status: InvocationStatus;
  policyDecision: 'allowed' | 'denied' | 'not_evaluated';
  inputSummary: Record<string, unknown>;
  resultSummary: Record<string, unknown> | null;
  errorCode: string | null;
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  expiresAt: Date;
}

function publicInvocation(record: ExecutionInvocationRecord): Omit<ExecutionInvocationRecord, 'idempotencyKeyHash' | 'requestHash'> {
  const { idempotencyKeyHash: _idempotencyKeyHash, requestHash: _requestHash, ...publicRecord } = record;
  return publicRecord;
}

export function summarizeExecutionUsage(
  groups: Array<{ toolName: string; status: string; count: number | string }>,
  input: {
    now?: Date;
    scope: 'principal' | 'organization';
    workflowGroups?: Array<{ contextPackVersionId: string | null; completedRuns: number | string }>;
    activeWeeks?: number | string;
  },
) {
  const now = input.now || new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const byTool = new Map<string, { completed: number; blocked: number; error: number; incomplete: number }>();
  for (const group of groups) {
    const totals = byTool.get(group.toolName) || { completed: 0, blocked: 0, error: 0, incomplete: 0 };
    const amount = Math.max(0, Number(group.count) || 0);
    if (group.status === 'completed') totals.completed += amount;
    else if (group.status === 'blocked') totals.blocked += amount;
    else if (group.status === 'error') totals.error += amount;
    else if (group.status === 'started' || group.status === 'outcome_unknown') totals.incomplete += amount;
    byTool.set(group.toolName, totals);
  }
  const tools = [...byTool.entries()].map(([toolName, counts]) => ({ toolName, ...counts }));
  const totals = tools.reduce((sum, row) => ({
    completed: sum.completed + row.completed,
    blocked: sum.blocked + row.blocked,
    error: sum.error + row.error,
    incomplete: sum.incomplete + row.incomplete,
  }), { completed: 0, blocked: 0, error: 0, incomplete: 0 });
  const repeatedWorkflows = (input.workflowGroups || [])
    .map((workflow) => ({
      contextPackVersionId: workflow.contextPackVersionId,
      completedRuns: Math.max(0, Number(workflow.completedRuns) || 0),
    }))
    .filter((workflow) => workflow.contextPackVersionId && workflow.completedRuns > 1);
  const completedRunCount = (input.workflowGroups || []).reduce(
    (sum, workflow) => sum + Math.max(0, Number(workflow.completedRuns) || 0), 0,
  );
  return {
    periodStart: periodStart.toISOString(), periodEnd: now.toISOString(), scope: input.scope,
    totals, billableActionCount: totals.completed, deniedActionsBillable: false,
    adoption: {
      completedRunCount,
      repeatedWorkflowVersionCount: repeatedWorkflows.length,
      repeatedCompletedRunCount: repeatedWorkflows.reduce((sum, workflow) => sum + workflow.completedRuns, 0),
      activeWeeks: Math.max(0, Number(input.activeWeeks) || 0),
    },
    rateUsd: null, billingMode: 'pilot_measurement_only', tools,
  };
}

export class ExecutionInvocationService {
  constructor(private readonly database: any = db) {}

  async start(input: {
    executionRunId: string;
    contextPackVersionId?: string | null;
    runReceiptId?: string | null;
    approvalGateId?: string | null;
    approvalReceiptId?: string | null;
    principalId: string;
    actorPrincipalId?: string | null;
    orgId?: string | null;
    connectionId?: string | null;
    toolName: string;
    policyVersion?: string | null;
    policyRuleIds?: string[];
    policyReasonCode?: string | null;
    policyScore?: number | null;
    idempotencyKeyHash?: string | null;
    requestHash?: string | null;
    inputSummary?: Record<string, unknown>;
  }): Promise<ExecutionInvocationRecord> {
    const now = new Date();
    const record = {
      id: randomUUID(),
      executionRunId: input.executionRunId,
      contextPackVersionId: input.contextPackVersionId || null,
      runReceiptId: input.runReceiptId || null,
      approvalGateId: input.approvalGateId || null,
      approvalReceiptId: input.approvalReceiptId || null,
      principalId: input.principalId,
      actorPrincipalId: input.actorPrincipalId || null,
      orgId: input.orgId || null,
      connectionId: input.connectionId || null,
      toolName: input.toolName,
      policyVersion: input.policyVersion || null,
      policyRuleIds: Array.isArray(input.policyRuleIds) ? input.policyRuleIds : [],
      policyReasonCode: input.policyReasonCode || null,
      policyScore: typeof input.policyScore === 'number' ? input.policyScore : null,
      idempotencyKeyHash: input.idempotencyKeyHash || null,
      requestHash: input.requestHash || null,
      status: 'started' as const,
      policyDecision: 'allowed' as const,
      inputSummary: input.inputSummary || {},
      resultSummary: null,
      errorCode: null,
      startedAt: now,
      completedAt: null,
      createdAt: now,
      expiresAt: executionRecordExpiresAt(now),
    };
    const rows = await this.database.insert(executionInvocations).values(record).returning();
    return (rows[0] || record) as ExecutionInvocationRecord;
  }

  async findByIdempotencyKey(principalId: string, idempotencyKeyHash: string): Promise<ExecutionInvocationRecord | null> {
    const rows = await this.database.select().from(executionInvocations)
      .where(and(
        eq(executionInvocations.principalId, principalId),
        eq(executionInvocations.idempotencyKeyHash, idempotencyKeyHash),
      )).limit(1);
    return (rows[0] as ExecutionInvocationRecord | undefined) || null;
  }

  async startIdempotent(input: {
    executionRunId: string;
    contextPackVersionId?: string | null;
    runReceiptId?: string | null;
    approvalGateId?: string | null;
    approvalReceiptId?: string | null;
    principalId: string;
    actorPrincipalId?: string | null;
    orgId?: string | null;
    connectionId?: string | null;
    toolName: string;
    policyVersion?: string | null;
    policyRuleIds?: string[];
    policyReasonCode?: string | null;
    policyScore?: number | null;
    idempotencyKeyHash: string;
    requestHash: string;
    inputSummary?: Record<string, unknown>;
  }): Promise<{ invocation: ExecutionInvocationRecord; duplicate: boolean }> {
    const existing = await this.findByIdempotencyKey(input.principalId, input.idempotencyKeyHash);
    if (existing) {
      if (existing.requestHash !== input.requestHash) throw new Error('execution_idempotency_conflict');
      return { invocation: existing, duplicate: true };
    }

    try {
      const invocation = await this.start(input);
      return { invocation, duplicate: false };
    } catch (error: any) {
      // The unique index arbitrates concurrent requests that passed the lookup together.
      if (error?.code !== '23505') throw error;
      const raced = await this.findByIdempotencyKey(input.principalId, input.idempotencyKeyHash);
      if (!raced) throw error;
      if (raced.requestHash !== input.requestHash) throw new Error('execution_idempotency_conflict');
      return { invocation: raced, duplicate: true };
    }
  }

  async finish(id: string, input: {
    status: Exclude<InvocationStatus, 'started'>;
    policyDecision?: 'allowed' | 'denied' | 'not_evaluated';
    resultSummary?: Record<string, unknown> | null;
    errorCode?: string | null;
  }): Promise<ExecutionInvocationRecord | null> {
    const rows = await this.database.update(executionInvocations).set({
      status: input.status,
      policyDecision: input.policyDecision || 'allowed',
      resultSummary: input.resultSummary || null,
      errorCode: input.errorCode || null,
      completedAt: new Date(),
    }).where(and(
      eq(executionInvocations.id, id),
      eq(executionInvocations.status, 'started'),
    )).returning();
    return (rows[0] as ExecutionInvocationRecord | undefined) || null;
  }

  async record(input: {
    executionRunId: string;
    contextPackVersionId?: string | null;
    runReceiptId?: string | null;
    approvalGateId?: string | null;
    approvalReceiptId?: string | null;
    principalId: string;
    actorPrincipalId?: string | null;
    orgId?: string | null;
    connectionId?: string | null;
    toolName: string;
    status: 'blocked' | 'error';
    policyDecision?: 'denied' | 'not_evaluated';
    policyVersion?: string | null;
    policyRuleIds?: string[];
    policyReasonCode?: string | null;
    policyScore?: number | null;
    errorCode?: string | null;
    inputSummary?: Record<string, unknown>;
  }): Promise<ExecutionInvocationRecord> {
    const now = new Date();
    const record = {
      id: randomUUID(), executionRunId: input.executionRunId,
      contextPackVersionId: input.contextPackVersionId || null, runReceiptId: input.runReceiptId || null,
      approvalGateId: input.approvalGateId || null, approvalReceiptId: input.approvalReceiptId || null,
      principalId: input.principalId,
      actorPrincipalId: input.actorPrincipalId || null,
      orgId: input.orgId || null, connectionId: input.connectionId || null,
      toolName: input.toolName, status: input.status,
      policyDecision: input.policyDecision || 'not_evaluated', inputSummary: input.inputSummary || {},
      policyVersion: input.policyVersion || null,
      policyRuleIds: Array.isArray(input.policyRuleIds) ? input.policyRuleIds : [],
      policyReasonCode: input.policyReasonCode || null,
      policyScore: typeof input.policyScore === 'number' ? input.policyScore : null,
      resultSummary: null, errorCode: input.errorCode || null,
      startedAt: now, completedAt: now, createdAt: now, expiresAt: executionRecordExpiresAt(now),
    };
    const rows = await this.database.insert(executionInvocations).values(record).returning();
    return (rows[0] || record) as ExecutionInvocationRecord;
  }

  async listOwned(executionRunId: string, principalId: string, limit = 50): Promise<ExecutionInvocationRecord[]> {
    const rows = await this.database.select().from(executionInvocations)
      .where(and(
        eq(executionInvocations.executionRunId, executionRunId),
        eq(executionInvocations.principalId, principalId),
        gte(executionInvocations.expiresAt, new Date()),
      ))
      .orderBy(desc(executionInvocations.createdAt))
      .limit(Math.min(Math.max(limit, 1), 100));
    return (rows as ExecutionInvocationRecord[])
      .filter((row) => row.principalId === principalId && (!row.expiresAt || new Date(row.expiresAt).getTime() > Date.now()))
      .map(publicInvocation) as ExecutionInvocationRecord[];
  }

  async listPrincipal(principalId: string, limit = 50): Promise<ExecutionInvocationRecord[]> {
    const rows = await this.database.select().from(executionInvocations)
      .where(and(eq(executionInvocations.principalId, principalId), gte(executionInvocations.expiresAt, new Date())))
      .orderBy(desc(executionInvocations.createdAt))
      .limit(Math.min(Math.max(limit, 1), 100));
    return (rows as ExecutionInvocationRecord[])
      .filter((row) => row.principalId === principalId && (!row.expiresAt || new Date(row.expiresAt).getTime() > Date.now()))
      .map(publicInvocation) as ExecutionInvocationRecord[];
  }

  async getMonthlyUsage(principalId: string, orgId?: string | null, now = new Date()) {
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const scopeFilter = orgId
      ? eq(executionInvocations.orgId, orgId)
      : eq(executionInvocations.principalId, principalId);
    const groups = await this.database.select({
      toolName: executionInvocations.toolName,
      status: executionInvocations.status,
      count: sql<number>`count(*)`,
    }).from(executionInvocations)
      .where(and(scopeFilter, gte(executionInvocations.createdAt, periodStart)))
      .groupBy(executionInvocations.toolName, executionInvocations.status);
    const workflowGroups = await this.database.select({
      contextPackVersionId: executionInvocations.contextPackVersionId,
      completedRuns: sql<number>`count(distinct ${executionInvocations.executionRunId})`,
    }).from(executionInvocations)
      .where(and(
        scopeFilter,
        gte(executionInvocations.createdAt, periodStart),
        eq(executionInvocations.status, 'completed'),
        isNotNull(executionInvocations.contextPackVersionId),
      ))
      .groupBy(executionInvocations.contextPackVersionId);
    const [weekStats] = await this.database.select({
      activeWeeks: sql<number>`count(distinct date_trunc('week', ${executionInvocations.createdAt}))`,
    }).from(executionInvocations)
      .where(and(
        scopeFilter,
        gte(executionInvocations.createdAt, periodStart),
        eq(executionInvocations.status, 'completed'),
      ));
    return summarizeExecutionUsage(groups as Array<{ toolName: string; status: string; count: number | string }>, {
      now,
      scope: orgId ? 'organization' : 'principal',
      workflowGroups: workflowGroups as Array<{ contextPackVersionId: string | null; completedRuns: number | string }>,
      activeWeeks: weekStats?.activeWeeks || 0,
    });
  }
}

export const executionInvocationService = new ExecutionInvocationService();
