/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

/**
 * Background Agent Run — durable, governed, human-in-the-loop execution.
 *
 * The platform layer of the reposition. Inngest provides durability (each
 * `step.run` is checkpointed and retried), the async wait primitive
 * (`step.waitForEvent` pauses for a human for days at zero compute), and
 * cancellation. ALL decisions come from the pure runtime (lib/agent-runtime.js).
 *
 *   for each proposed step:
 *     context -> loadGovernanceContext()          [ORG spend, not just this run]
 *     gate    -> planStep(policy, run+org, call)  [firewall + loop detector]
 *     pause?  -> signed approval card & waitForEvent('agent/run.approve')
 *     block?  -> stop the runaway before the spend
 *     sandbox -> executeTool()
 *     execute -> (model call / estimate)
 *     record  -> recordHit(savings ledger)        [verifiable ROI]
 *     persist -> persistRun()                     [durable, queryable, ownable]
 *
 * `cancelOn` is what makes POST /api/agent/cancel real: previously the cancel
 * event was emitted and nothing listened, so the "emergency kill" flipped a
 * database row while the run kept spending.
 */

import { neon } from '@neondatabase/serverless';
import { inngest } from '../client.js';
import { initRun, planStep, reduceRun, isTerminal, RUN, checkpoint } from '../../../lib/agent-runtime.js';
import { recordHit } from '../../../lib/savings-recorder.js';
import { executeTool } from '../../../lib/agent-sandbox.js';
import { buildApprovalCard, dispatchNotification } from '../../../lib/hitl-notifier.js';
import { signApprovalToken, isValidRunId } from '../../../lib/run-authz.js';
import { loadGovernanceContext, mergeRunContext, persistRun, ensureAgentRunSchema } from '../../../lib/run-store.js';

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;

export const agentRun = inngest.createFunction(
  {
    id: 'agent-run',
    name: 'Background Agent Run (governed + HITL + sandbox)',
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
      webhookUrl = null,
    } = event.data as any;

    // runId is interpolated into the CEL match below — refuse anything that
    // could escape the string literal and widen the match to other runs.
    if (!isValidRunId(runId)) {
      return { status: 'rejected', reason: 'invalid runId', runId: String(runId).slice(0, 64) };
    }

    let run = initRun({ runId, agentId, namespace, goal });

    // Org-wide governance posture, loaded durably once. This is the difference
    // between "this run has spent $0" and "this ORG has spent $3,900 today".
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
          runId, status: run.status, reason: plan.reasons,
          stepsExecuted: run.stepsExecuted, spentUsd: run.spentUsd, savedUsd: run.savedUsd,
          checkpoint: checkpoint(run),
        };
      }

      // 3) ASYNC HITL — pause for a human. The approval card carries SIGNED,
      //    expiring, single-decision links so a Slack button is safe to click
      //    without an API key and useless to anyone it wasn't issued for.
      if (run.status === RUN.PAUSED) {
        await save({ _tag: `paused-${i}`, reasons: plan.reasons });
        if (webhookUrl) {
          await step.run(`notify-hitl-${i}`, async () => {
            const secret = process.env.HITL_SIGNING_KEY || '';
            let tokens: any = null;
            if (secret) {
              tokens = {
                approve: await signApprovalToken(secret, { runId, organizationId, step: i, decision: 'approve' }),
                reject: await signApprovalToken(secret, { runId, organizationId, step: i, decision: 'reject' }),
              };
            }
            const card = buildApprovalCard(run, run.pending, {
              baseUrl: process.env.PUBLIC_APP_URL || 'https://agentcache.ai',
              tokens,
            });
            return dispatchNotification(webhookUrl, card);
          });
        }

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
            runId, status: run.status, reason: 'human rejected or approval timed out',
            stepsExecuted: run.stepsExecuted, checkpoint: checkpoint(run),
          };
        }
      }

      // 4) TOOL SANDBOX (if this step requests a tool execution)
      if (call.toolCall) {
        const toolResult = await step.run(`sandbox-tool-${i}`, async () => executeTool(call.toolCall));
        run = reduceRun(run, { type: 'TOOL_EXECUTE', toolCall: call.toolCall, toolResult }, new Date().toISOString());
      }

      // 5) EXECUTE — model/tool charge & token accounting.
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

      // 6) RECORD — persist any savings on this step to the verifiable ledger.
      if (result.layer && sql) {
        await step.run(`record-${i}`, () =>
          recordHit({ sql }, {
            organizationId, namespace, agentId,
            event: {
              layer: result.layer, model: result.model,
              inputTokens: result.inputTokens, outputTokens: result.outputTokens,
              prefixTokens: result.prefixTokens,
            },
          }).catch(() => null));
      }

      // 7) PERSIST — the run is now queryable and its spend is real.
      await save({ _tag: `step-${i}` });

      if (isTerminal(run)) break;
    }

    run = reduceRun(run, { type: 'COMPLETE' }, new Date().toISOString());
    await save({ _tag: 'complete' });

    return {
      runId, status: run.status, stepsExecuted: run.stepsExecuted,
      spentUsd: run.spentUsd, savedUsd: run.savedUsd,
      reasoning: run.reasoning, toolResults: run.toolResults,
      checkpoint: checkpoint(run),
    };
  },
);
