import { desc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db } from '../db/client.js';
import { executionDecisionEvents } from '../db/schema.js';
import { redactSensitiveData } from '../lib/redact-sensitive-data.js';
import { redactPII } from '../lib/pii/redactor.js';
import { executionRecordExpiresAt } from './ExecutionRetentionPolicy.js';

export type ExecutionDecisionEventType = 'run_started' | 'review_recorded' | 'gate_decided' | 'phase_advanced';

export interface ExecutionDecisionEvent {
  id: string;
  eventType: ExecutionDecisionEventType;
  executionRunId: string;
  contextPackId: string | null;
  contextPackVersionId: string | null;
  ownerPrincipalId: string | null;
  actorPrincipalId: string | null;
  organizationId: string | null;
  actorRole: string | null;
  verdict: string | null;
  summary: string | null;
  findings: string[];
  confidence: number | null;
  status: string | null;
  phase: string | null;
  receiptId: string | null;
  occurredAt: Date;
  expiresAt?: Date | string | null;
}

export class ExecutionDecisionAuditService {
  constructor(private readonly database: any = db) {}

  async record(input: Omit<ExecutionDecisionEvent, 'id' | 'occurredAt'>): Promise<ExecutionDecisionEvent> {
    const summary = input.summary == null
      ? null
      : redactPII(String(redactSensitiveData(input.summary)).slice(0, 2000)).redacted;
    const findings = Array.isArray(input.findings)
      ? input.findings.slice(0, 20).map((finding) => redactPII(String(redactSensitiveData(finding)).slice(0, 500)).redacted)
      : [];
    const now = new Date();
    const event = { id: randomUUID(), ...input, summary, findings, occurredAt: now, expiresAt: executionRecordExpiresAt(now) };
    const rows = await this.database.insert(executionDecisionEvents).values(event).returning();
    return (rows[0] || event) as ExecutionDecisionEvent;
  }

  async listForRun(executionRunId: string, ownerPrincipalId: string): Promise<ExecutionDecisionEvent[]> {
    const rows = await this.database.select().from(executionDecisionEvents)
      .where(eq(executionDecisionEvents.executionRunId, executionRunId))
      .orderBy(desc(executionDecisionEvents.occurredAt))
      .limit(500);
    return (rows as ExecutionDecisionEvent[])
      .filter((row) => row.executionRunId === executionRunId && row.ownerPrincipalId === ownerPrincipalId)
      .filter((row) => !row.expiresAt || new Date(row.expiresAt).getTime() > Date.now())
      .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
  }

  async listForOwner(ownerPrincipalId: string, limit = 50): Promise<ExecutionDecisionEvent[]> {
    const rows = await this.database.select().from(executionDecisionEvents)
      .where(eq(executionDecisionEvents.ownerPrincipalId, ownerPrincipalId))
      .orderBy(desc(executionDecisionEvents.occurredAt))
      .limit(Math.min(Math.max(limit, 1), 100));
    return (rows as ExecutionDecisionEvent[])
      .filter((row) => row.ownerPrincipalId === ownerPrincipalId)
      .filter((row) => !row.expiresAt || new Date(row.expiresAt).getTime() > Date.now())
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .slice(0, Math.min(Math.max(limit, 1), 100));
  }
}

export const executionDecisionAuditService = new ExecutionDecisionAuditService();
