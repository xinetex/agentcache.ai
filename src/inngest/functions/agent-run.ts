/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

/**
 * Legacy planning simulation — durable state, budget checks, HITL, and built-in
 * sandbox helpers. It does not invoke LLM providers or external tools.
 *
 * This legacy harness is separate from governed provider execution. Inngest
 * provides durability (each
 * `step.run` is checkpointed and retried), the async wait primitive
 * (`step.waitForEvent` pauses for a human for days at zero compute), and
 * cancellation. ALL decisions come from the pure runtime (lib/agent-runtime.js).
 *
 *   for each proposed step:
 *     context -> loadGovernanceContext()          [ORG spend, not just this run]
 *     gate    -> planStep(policy, run+org, call)  [budget + loop checks]
 *     pause?  -> signed approval card & waitForEvent('agent/run.approve')
 *     block?  -> stop before accounting the declared estimate
 *     sandbox -> executeTool()
 *     execute -> account caller-declared model/token estimates (no provider call)
 *     record  -> keep modeled savings on this run only (never global analytics)
 *     persist -> persistRun()                     [durable, queryable, ownable]
 *
 * `cancelOn` is what makes POST /api/agent/cancel real: previously the cancel
 * event was emitted and nothing listened, so the "emergency kill" flipped a
 * database row while the simulation continued.
 */

import { neon } from '@neondatabase/serverless';
import { inngest } from '../client.js';
import { initRun, planStep, reduceRun, isTerminal, RUN, checkpoint } from '../../../lib/agent-runtime.js';
import { executeTool } from '../../../lib/agent-sandbox.js';
import { isValidRunId } from '../../../lib/run-authz.js';
import { loadGovernanceContext, mergeRunContext, persistRun, ensureAgentRunSchema } from '../../../lib/run-store.js';

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
const SIMULATION_METADATA = {
  mode: 'planning_simulation',
  providerCallsEnabled: false,
  costBasis: 'caller_declared_estimates',
  savingsBasis: 'caller_declared_cache_fields',
};

export const agentRun = inngest.createFunction(
  {
    id: 'agent-run',
    name: 'Background Planning Simulation (budgeted + HITL + built-ins)',
    // EMERGENCY KILL. Without this, agent/run.cancel was a no-op.
    cancelOn: [{ event: 'agent/run.cancel', if: 'async.data.runId == event.data.runId' }],
  },
  { event: 'agent/run.start' },
  async ({ event, step }) => {
    const {
      runId,
      agentId = 'default',
      namespace = 'default',
      organizationId = 'default_org',
      goal = '',
      steps = [],
      approvalThresholdUsd = 0,
    } = event.data as any;

    // runId is interpolated into the CEL match below — refuse anything that
    // could escape the string literal and widen the match to other runs.
    if (!isValidRunId(runId)) {
      return { ...SIMULATION_METADATA, status: 'rejected', reason: 'invalid runId', runId: String(runId).slice(0, 64) };
    }

    let run = initRun({ runId, agentId, namespace, goal });

    // Load the account's stored policy and usage baseline. Per-step costs below
    // remain caller-declared simulation estimates, not provider spend.
    const ctx: any = await step.run('load-context', async () => {
      if (!sql) return { policy: {}, org: { spentUsd: 0, usedRequests: 0, series: [] } };
      await ensureAgentRunSchema(sql);
      return loadGovernanceContext(sql, organizationId).catch(() => ({
        policy: {}, org: { spentUsd: 0, usedRequests: 0, series: [] },
      }));
    });
    const policy = ctx.policy || {};
    const org = ctx.org || { spentUsd: 0, usedRequests: 0, series: [] };

    const save = (extra: any = {}) =>
      step.run(`persist-${extra._tag || run.step}`, async () =>
        persistRun({ sql }, run, { organizationId, checkpoint: checkpoint(run), ...extra }));

    await save({ _tag: 'start' });

    for (let i = 0; i < steps.length; i++) {
      const call = steps[i];

      // 1) GATE — verdict against org spend + this run's spend to date.
      const plan = await step.run(`gate-${i}`, async () =>
        planStep({ policy, run: mergeRunContext(run, org), proposedCall: call, approvalThresholdUsd }));
      run = reduceRun(run, { type: 'PLAN', plan, proposedCall: call }, new Date().toISOString());

      // 2) HARD BLOCK — budget/quota/kill-switch/cyclic-loop. Stop before the spend.
      if (run.status === RUN.BLOCKED) {
        await save({ _tag: `blocked-${i}`, reasons: plan.reasons });
        return {
          ...SIMULATION_METADATA, runId, status: run.status, reason: plan.reasons,
          stepsExecuted: run.stepsExecuted, spentUsd: run.spentUsd, savedUsd: run.savedUsd,
          checkpoint: checkpoint(run),
        };
      }

      // 3) ASYNC HITL — pause for an authenticated human decision via API.
      if (run.status === RUN.PAUSED) {
        await save({ _tag: `paused-${i}`, reasons: plan.reasons });
        const approval: any = await step.waitForEvent(`await-approval-${i}`, {
          event: 'agent/run.approve',
          timeout: '7d',
          if: `async.data.runId == "${runId}"`,
        });

        const decision = approval?.data?.decision === 'approve' ? 'approve' : 'reject';
        run = reduceRun(run, { type: 'RESUME', decision }, new Date().toISOString());
        if (run.status === RUN.KILLED) {
          await save({ _tag: `killed-${i}`, reasons: ['human rejected or approval timed out'] });
          return {
            ...SIMULATION_METADATA, runId, status: run.status, reason: 'human rejected or approval timed out',
            stepsExecuted: run.stepsExecuted, checkpoint: checkpoint(run),
          };
        }
      }

      // 4) TOOL SANDBOX (if this step requests a tool execution)
      if (call.toolCall) {
        const toolResult = await step.run(`sandbox-tool-${i}`, async () => executeTool(call.toolCall));
        run = reduceRun(run, { type: 'TOOL_EXECUTE', toolCall: call.toolCall, toolResult }, new Date().toISOString());
      }

      // 5) ACCOUNT — record the caller-declared estimate; no model provider is called.
      const result = await step.run(`execute-${i}`, async () => ({
        // Default to a PRICED model id. 'claude-3-5-sonnet' is absent from the
        // price table, so an unspecified step was silently costed at $0 —
        // invisible to the budget gate and worth nothing in the savings ledger.
        model: call.model || 'claude-sonnet-5',
        layer: call.cacheLayer || null,
        inputTokens: call.inputTokens || 0,
        outputTokens: call.outputTokens || 0,
        prefixTokens: call.prefixTokens || 0,
        costUsd: plan.estCostUsd,
      }));
      run = reduceRun(run, { type: 'EXECUTE', result, reasoningDelta: call.remember || null }, new Date().toISOString());

      // 6) PERSIST — keep modeled values on this simulation only. Never write
      // caller-declared cache savings into organization-wide savings analytics.
      await save({ _tag: `step-${i}` });

      if (isTerminal(run)) break;
    }

    run = reduceRun(run, { type: 'COMPLETE' }, new Date().toISOString());
    await save({ _tag: 'complete' });

    return {
      ...SIMULATION_METADATA,
      runId, status: run.status, stepsExecuted: run.stepsExecuted,
      spentUsd: run.spentUsd, savedUsd: run.savedUsd,
      reasoning: run.reasoning, toolResults: run.toolResults,
      checkpoint: checkpoint(run),
    };
  },
);
