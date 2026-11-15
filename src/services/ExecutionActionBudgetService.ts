import { and, eq, gt, lte, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db } from '../db/client.js';
import { executionActionBudgets, executionActionReservations } from '../db/schema.js';

export type ExecutionBudgetScopeType = 'organization' | 'principal';

export class ExecutionActionBudgetService {
  constructor(private readonly database: any = db) {}

  async configure(input: {
    scopeType: ExecutionBudgetScopeType;
    scopeId: string;
    periodStart: Date;
    periodEnd: Date;
    actionLimit: number;
    configuredBy: string;
  }) {
    return this.database.transaction(async (tx: any) => {
      const [existing] = await tx.select().from(executionActionBudgets).where(and(
        eq(executionActionBudgets.scopeType, input.scopeType),
        eq(executionActionBudgets.scopeId, input.scopeId),
      )).for('update').limit(1);
      const samePeriod = existing
        && new Date(existing.periodStart).getTime() === input.periodStart.getTime()
        && new Date(existing.periodEnd).getTime() === input.periodEnd.getTime();
      const values = {
        id: existing?.id || randomUUID(),
        scopeType: input.scopeType,
        scopeId: input.scopeId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        actionLimit: input.actionLimit,
        reservedCount: samePeriod ? Number(existing.reservedCount) : 0,
        configuredBy: input.configuredBy,
        createdAt: existing?.createdAt || new Date(),
        updatedAt: new Date(),
      };
      const [budget] = await tx.insert(executionActionBudgets).values(values).onConflictDoUpdate({
        target: [executionActionBudgets.scopeType, executionActionBudgets.scopeId],
        set: {
          periodStart: values.periodStart,
          periodEnd: values.periodEnd,
          actionLimit: values.actionLimit,
          reservedCount: values.reservedCount,
          configuredBy: values.configuredBy,
          updatedAt: values.updatedAt,
        },
      }).returning();
      return budget || values;
    });
  }

  async get(scopeType: ExecutionBudgetScopeType, scopeId: string) {
    const [budget] = await this.database.select().from(executionActionBudgets).where(and(
      eq(executionActionBudgets.scopeType, scopeType),
      eq(executionActionBudgets.scopeId, scopeId),
    )).limit(1);
    return budget || null;
  }

  async reserve(input: {
    scopeType: ExecutionBudgetScopeType;
    scopeId: string;
    invocationId: string;
    executionRunId: string;
    now?: Date;
  }) {
    const now = input.now || new Date();
    if (this.database.__isMock) {
      return this.database.transaction(async (tx: any) => {
        const [budget] = await tx.select().from(executionActionBudgets).where(and(
          eq(executionActionBudgets.scopeType, input.scopeType),
          eq(executionActionBudgets.scopeId, input.scopeId),
        )).limit(1);
        if (!budget) return { allowed: false as const, reasonCode: 'execution_action_budget_not_configured' };
        if (new Date(budget.periodStart).getTime() > now.getTime() || new Date(budget.periodEnd).getTime() <= now.getTime()) {
          return { allowed: false as const, reasonCode: 'execution_action_budget_inactive' };
        }
        if (Number(budget.reservedCount) >= Number(budget.actionLimit)) {
          return { allowed: false as const, reasonCode: 'execution_action_cap_reached', reservedCount: Number(budget.reservedCount), actionLimit: Number(budget.actionLimit), periodEnd: new Date(budget.periodEnd) };
        }
        const reservedCount = Number(budget.reservedCount) + 1;
        await tx.update(executionActionBudgets).set({ reservedCount, updatedAt: now }).where(eq(executionActionBudgets.id, budget.id));
        await tx.insert(executionActionReservations).values({ budgetId: budget.id, invocationId: input.invocationId, executionRunId: input.executionRunId, createdAt: now });
        return { allowed: true as const, reservedCount, actionLimit: Number(budget.actionLimit), remaining: Math.max(0, Number(budget.actionLimit) - reservedCount), periodEnd: new Date(budget.periodEnd) };
      });
    }
    return this.database.transaction(async (tx: any) => {
      const [budget] = await tx.update(executionActionBudgets).set({
        reservedCount: sql`${executionActionBudgets.reservedCount} + 1`,
        updatedAt: now,
      }).where(and(
        eq(executionActionBudgets.scopeType, input.scopeType),
        eq(executionActionBudgets.scopeId, input.scopeId),
        lte(executionActionBudgets.periodStart, now),
        gt(executionActionBudgets.periodEnd, now),
        sql`${executionActionBudgets.reservedCount} < ${executionActionBudgets.actionLimit}`,
      )).returning();

      if (budget) {
        const [reservation] = await tx.insert(executionActionReservations).values({
          budgetId: budget.id,
          invocationId: input.invocationId,
          executionRunId: input.executionRunId,
          createdAt: now,
        }).returning();
        if (!reservation) throw new Error('execution_action_reservation_conflict');
        return {
          allowed: true as const,
          reservedCount: Number(budget.reservedCount),
          actionLimit: Number(budget.actionLimit),
          remaining: Math.max(0, Number(budget.actionLimit) - Number(budget.reservedCount)),
          periodEnd: new Date(budget.periodEnd),
        };
      }

      const [configured] = await tx.select().from(executionActionBudgets).where(and(
        eq(executionActionBudgets.scopeType, input.scopeType),
        eq(executionActionBudgets.scopeId, input.scopeId),
      )).limit(1);
      if (!configured) return { allowed: false as const, reasonCode: 'execution_action_budget_not_configured' };
      if (new Date(configured.periodStart).getTime() > now.getTime() || new Date(configured.periodEnd).getTime() <= now.getTime()) {
        return { allowed: false as const, reasonCode: 'execution_action_budget_inactive' };
      }
      return {
        allowed: false as const,
        reasonCode: 'execution_action_cap_reached',
        reservedCount: Number(configured.reservedCount),
        actionLimit: Number(configured.actionLimit),
        periodEnd: new Date(configured.periodEnd),
      };
    });
  }
}

export const executionActionBudgetService = new ExecutionActionBudgetService();
