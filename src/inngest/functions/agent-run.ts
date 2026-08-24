/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

/**
 * Background Agent Run — durable, governed, human-in-the-loop execution.
 *
 * The platform layer of the reposition. Inngest provides durability (each
 * `step.run` is checkpointed and retried) and the async wait primitive
 * (`step.waitForEvent` pauses a long-running agent for a human, for up to days,
 * with zero compute burned while waiting). ALL the decisions come from the pure,
 * unit-tested runtime (lib/agent-runtime.js):
 *
 *   for each proposed step:
 *     gate    -> planStep(policy, run, call)     [governance firewall]
 *     pause?  -> waitForEvent('agent/run.approve') [async HITL]
 *     block?  -> stop the runaway before the spend
 *     execute -> (your model call goes here)
 *     record  -> recordHit(savings ledger)        [verifiable ROI]
 *
 * Trigger: inngest.send({ name: 'agent/run.start', data: { runId, agentId,
 *   namespace, organizationId, steps: [{ model, inputTokens, outputTokens,
 *   requiresApproval? }], approvalThresholdUsd? } })
 */

import { neon } from '@neondatabase/serverless';
import { inngest } from '../client.js';
import { initRun, planStep, reduceRun, isTerminal, RUN } from '../../../lib/agent-runtime.js';
import { loadPolicy } from '../../../lib/governance-data.js';
import { recordHit } from '../../../lib/savings-recorder.js';

const sql = neon(process.env.DATABASE_URL!);

export const agentRun = inngest.createFunction(
  { id: 'agent-run', name: 'Background Agent Run (governed + HITL)' },
  { event: 'agent/run.start' },
  async ({ event, step }) => {
    const { runId, agentId, namespace, organizationId, steps = [], approvalThresholdUsd = 0 } = event.data as any;

    // Policy is loaded once, durably (retried until it succeeds).
    const policy = await step.run('load-policy', () => loadPolicy(sql, organizationId));

    let run = initRun({ runId, agentId, namespace });

    for (let i = 0; i < steps.length; i++) {
      const call = steps[i];

      // 1) GATE — deterministic verdict from the governance firewall.
      const plan = await step.run(`gate-${i}`, async () => planStep({ policy, run, proposedCall: call, approvalThresholdUsd }));
      run = reduceRun(run, { type: 'PLAN', plan, proposedCall: call }, new Date().toISOString());

      // 2) HARD BLOCK — budget/quota/kill-switch. Stop before spending a cent.
      if (run.status === RUN.BLOCKED) {
        return { runId, status: run.status, reason: plan.reasons, stepsExecuted: run.stepsExecuted, spentUsd: run.spentUsd, savedUsd: run.savedUsd };
      }

      // 3) ASYNC HITL — pause for a human, resumed by POST /api/agent/approve.
      if (run.status === RUN.PAUSED) {
        const approval: any = await step.waitForEvent(`await-approval-${i}`, {
          event: 'agent/run.approve',
          timeout: '7d',
          if: `async.data.runId == "${runId}"`,
        });
        const decision = approval?.data?.decision === 'approve' ? 'approve' : 'reject';
        run = reduceRun(run, { type: 'RESUME', decision }, new Date().toISOString());
        if (run.status === RUN.KILLED) {
          return { runId, status: run.status, reason: 'human rejected or approval timed out', stepsExecuted: run.stepsExecuted };
        }
      }

      // 4) EXECUTE — YOUR real model/tool call goes here. The prototype charges
      //    the estimated cost so the governance + ledger loop is exercised
      //    end-to-end; replace `result` with your provider response + usage.
      const result = await step.run(`execute-${i}`, async () => ({
        model: call.model,
        layer: call.cacheLayer || null,          // set when this step was served from cache
        inputTokens: call.inputTokens || 0,
        outputTokens: call.outputTokens || 0,
        prefixTokens: call.prefixTokens || 0,
        costUsd: plan.estCostUsd,
      }));
      run = reduceRun(run, { type: 'EXECUTE', result, reasoningDelta: call.remember || null }, new Date().toISOString());

      // 5) RECORD — persist any savings on this step to the verifiable ledger.
      if (result.layer) {
        await step.run(`record-${i}`, () =>
          recordHit({ sql }, { organizationId, namespace, agentId, event: { layer: result.layer, model: result.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens, prefixTokens: result.prefixTokens } }));
      }

      if (isTerminal(run)) break;
    }

    run = reduceRun(run, { type: 'COMPLETE' }, new Date().toISOString());
    return { runId, status: run.status, stepsExecuted: run.stepsExecuted, spentUsd: run.spentUsd, savedUsd: run.savedUsd, reasoning: run.reasoning };
  },
);
