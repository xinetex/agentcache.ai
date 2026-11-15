import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { executionControlRecords } from '../db/schema.js';
import { redactSensitiveData } from '../lib/redact-sensitive-data.js';
import { redactPII } from '../lib/pii/redactor.js';
import { executionRecordExpiresAt } from './ExecutionRetentionPolicy.js';

export type ExecutionControlRecordType = 'context_pack' | 'context_pack_version' | 'run' | 'review' | 'gate';

function sanitizeForStorage(value: unknown): any {
  const redacted = redactSensitiveData(value);
  if (typeof redacted === 'string') return redactPII(redacted).redacted;
  if (Array.isArray(redacted)) return redacted.map(sanitizeForStorage);
  if (redacted && typeof redacted === 'object') {
    return Object.fromEntries(Object.entries(redacted as Record<string, unknown>).map(([key, item]) => [key, sanitizeForStorage(item)]));
  }
  return redacted;
}

export class ExecutionControlRecordService {
  constructor(private readonly database: any = db) {}

  async upsert(input: {
    recordType: ExecutionControlRecordType;
    recordId: string;
    ownerPrincipalId?: string | null;
    organizationId?: string | null;
    payload: unknown;
  }) {
    const now = new Date();
    const values = {
      recordType: input.recordType,
      recordId: input.recordId,
      ownerPrincipalId: input.ownerPrincipalId || null,
      organizationId: input.organizationId || null,
      status: typeof (input.payload as any)?.status === 'string' ? (input.payload as any).status : null,
      payload: sanitizeForStorage(input.payload),
      updatedAt: now,
      expiresAt: executionRecordExpiresAt(now),
    };
    const rows = await this.database.insert(executionControlRecords).values(values)
      .onConflictDoUpdate({
        target: [executionControlRecords.recordType, executionControlRecords.recordId],
        set: {
          ownerPrincipalId: values.ownerPrincipalId,
          organizationId: values.organizationId,
          status: values.status,
          payload: values.payload,
          updatedAt: now,
          expiresAt: values.expiresAt,
        },
      }).returning();
    return rows[0] || values;
  }

  async transition(input: {
    recordType: ExecutionControlRecordType;
    recordId: string;
    expectedStatus: string;
    ownerPrincipalId?: string | null;
    organizationId?: string | null;
    payload: unknown;
  }) {
    const now = new Date();
    const payload = sanitizeForStorage(input.payload);
    const rows = await this.database.update(executionControlRecords).set({
      ownerPrincipalId: input.ownerPrincipalId || null,
      organizationId: input.organizationId || null,
      status: typeof payload?.status === 'string' ? payload.status : null,
      payload,
      updatedAt: now,
      expiresAt: executionRecordExpiresAt(now),
    }).where(and(
      eq(executionControlRecords.recordType, input.recordType),
      eq(executionControlRecords.recordId, input.recordId),
      eq(executionControlRecords.status, input.expectedStatus),
    )).returning();
    return rows[0] || null;
  }

  async get(recordType: ExecutionControlRecordType, recordId: string): Promise<any | null> {
    const rows = await this.database.select().from(executionControlRecords)
      .where(and(
        eq(executionControlRecords.recordType, recordType),
        eq(executionControlRecords.recordId, recordId),
      ));
    const row = (rows as any[]).find((item) => item.recordType === recordType && item.recordId === recordId);
    if (!row || (row.expiresAt && new Date(row.expiresAt).getTime() <= Date.now())) return null;
    return row.payload || null;
  }

  async listOwned(recordType: ExecutionControlRecordType, ownerPrincipalId: string, limit = 50): Promise<any[]> {
    const boundedLimit = Math.min(Math.max(limit, 1), 100);
    const rows = await this.database.select().from(executionControlRecords)
      .where(and(
        eq(executionControlRecords.recordType, recordType),
        eq(executionControlRecords.ownerPrincipalId, ownerPrincipalId),
      ))
      .orderBy(desc(executionControlRecords.updatedAt))
      .limit(boundedLimit);
    return (rows as any[])
      .filter((row) => row.recordType === recordType && row.ownerPrincipalId === ownerPrincipalId)
      .filter((row) => !row.expiresAt || new Date(row.expiresAt).getTime() > Date.now())
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, boundedLimit)
      .map((row) => row.payload);
  }
}

export const executionControlRecordService = new ExecutionControlRecordService();
