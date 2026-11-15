import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { executionControlRecords, executionDecisionEvents, executionInvocations } from '../db/schema.js';
import { executionRetentionBounds, getExecutionRetentionDays } from './ExecutionRetentionPolicy.js';

export class ExecutionRetentionService {
  constructor(private readonly database: any = db) {}

  async purgeExpired(now = new Date()) {
    if (this.database.__isMock) {
      return { skipped: true, reason: 'mock_database', outcomeUnknown: 0, purged: { invocations: 0, decisions: 0, workflowRecords: 0, reviewerAssignments: 0 }, retentionDays: getExecutionRetentionDays(), retentionBounds: executionRetentionBounds };
    }
    const outcomeUnknown = await this.markStaleInvocationsUnknown(now);
    const [invocations, decisions, workflowRecords, reviewerAssignments] = await Promise.all([
      this.purgeTable('execution_invocations', now),
      this.purgeTable('execution_decision_events', now),
      this.purgeTable('execution_control_records', now),
      this.purgeTable('execution_review_assignments', now),
    ]);
    return {
      skipped: false,
      outcomeUnknown,
      purged: { invocations, decisions, workflowRecords, reviewerAssignments },
      total: invocations + decisions + workflowRecords + reviewerAssignments,
      retentionDays: getExecutionRetentionDays(),
      retentionBounds: executionRetentionBounds,
      completedAt: now.toISOString(),
    };
  }

  /** A crashed worker can leave a call in `started`. After a conservative
   * threshold, record that the provider outcome needs operator reconciliation;
   * never imply failure or retry a potentially completed side effect. */
  private async markStaleInvocationsUnknown(now: Date): Promise<number> {
    const staleBefore = new Date(now.getTime() - 15 * 60 * 1000);
    const batchSize = 1000;
    let marked = 0;
    for (let batch = 0; batch < 5; batch++) {
      const result = await this.database.execute(sql`
        WITH stale AS (
          SELECT id FROM execution_invocations
          WHERE status = 'started' AND started_at <= ${staleBefore}
          ORDER BY started_at
          LIMIT ${batchSize}
        )
        UPDATE execution_invocations AS target
        SET status = 'outcome_unknown',
            error_code = 'outcome_unknown_reconcile_required',
            completed_at = ${now}
        FROM stale
        WHERE target.id = stale.id AND target.status = 'started'
        RETURNING target.id
      `);
      const count = Array.isArray(result) ? result.length : Number(result?.rowCount || 0);
      marked += count;
      if (count < batchSize) break;
    }
    return marked;
  }

  private async purgeTable(tableName: string, now: Date): Promise<number> {
    const batchSize = 1000;
    let deleted = 0;
    for (let batch = 0; batch < 5; batch++) {
      const result = await this.database.execute(sql`
        WITH expired AS (
          SELECT id FROM ${sql.identifier(tableName)}
          WHERE expires_at <= ${now}
          ORDER BY expires_at
          LIMIT ${batchSize}
        )
        DELETE FROM ${sql.identifier(tableName)} AS target
        USING expired
        WHERE target.id = expired.id
        RETURNING target.id
      `);
      const count = Array.isArray(result) ? result.length : Number(result?.rowCount || 0);
      deleted += count;
      if (count < batchSize) break;
    }
    return deleted;
  }
}

export const executionRetentionService = new ExecutionRetentionService();
