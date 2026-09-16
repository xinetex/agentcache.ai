// lib/agent-harness.js
//
// AgentCache — Drop-In Agent Scaffolding Harness.
//
// A lightweight, engine-agnostic client harness for autonomous agents.
// Wraps model interactions, tool executions, and multi-turn loops with:
//   1. Observation & context compaction (preventing token degeneration)
//   2. Cyclic loop anomaly detection (stopping infinite repetitive tool calls)
//   3. Pre-spend governance & hard budget caps
//   4. Cross-run reasoning state persistence (resuming where prior runs left off)
//   5. Asynchronous Human-in-the-Loop (HITL) pause hooks
//   6. Verifiable token and dollar savings tracking

import { initRun, planStep, reduceRun, RUN, isTerminal } from './agent-runtime.js';
import { truncateObservation, compactHistory } from './context-compactor.js';
import { executeTool as runSandboxTool } from './agent-sandbox.js';
import { buildApprovalCard } from './hitl-notifier.js';
import { taskFingerprint, mergeState } from './reasoning-cache.js';
import { sanitizeToolArguments, createGroundedReceipt } from './grounded-verifier.js';
import { evaluateLinguisticPosture } from './linguistic-guard.js';

export class AgentHarness {
  /**
   * @param {Object} options
   * @param {string} [options.agentId='default_agent'] - Identifier for this agent/role
   * @param {string} [options.namespace='default'] - Multi-tenant namespace
   * @param {number} [options.maxBudgetUsd=100] - Hard spending cap per run
   * @param {number} [options.approvalThresholdUsd=0] - Single-call spend limit that triggers HITL
   * @param {boolean} [options.autoCompact=true] - Automatically compact bulky context
   * @param {number} [options.maxObservationChars=2000] - Max chars per raw tool output
   * @param {number} [options.maxHistoryTokens=6000] - Token threshold for history distillation
   * @param {boolean} [options.persistReasoning=true] - Carry facts/decisions across sessions
   * @param {Object} [options.customTools={}] - Registry of custom tool functions
   * @param {Function} [options.onApprovalRequired] - Async callback when a step pauses for approval
   */
  constructor(options = {}) {
    this.agentId = options.agentId || 'default_agent';
    this.namespace = options.namespace || 'default';
    this.maxBudgetUsd = typeof options.maxBudgetUsd === 'number' ? options.maxBudgetUsd : 100;
    this.approvalThresholdUsd = typeof options.approvalThresholdUsd === 'number' ? options.approvalThresholdUsd : 0;
    this.autoCompact = options.autoCompact !== false;
    this.maxObservationChars = options.maxObservationChars || 2000;
    this.maxHistoryTokens = options.maxHistoryTokens || 6000;
    this.persistReasoning = options.persistReasoning !== false;
    this.customTools = options.customTools || {};
    this.onApprovalRequired = options.onApprovalRequired || null;

    // In-memory reasoning memory store (fallback/local)
    this.memoryStore = options.memoryStore || new Map();
  }

  /**
   * Initializes a new governed run for a given task.
   * Pulls prior reasoning memory if `persistReasoning` is enabled.
   */
  startRun(task, opts = {}) {
    const runId = opts.runId || `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const taskKey = typeof task === 'string' ? task : JSON.stringify(task);
    const fp = taskFingerprint(this.agentId, taskKey);

    let carriedReasoning = null;
    if (this.persistReasoning && this.memoryStore.has(fp)) {
      carriedReasoning = this.memoryStore.get(fp);
    }

    const run = initRun({
      runId,
      agentId: this.agentId,
      namespace: this.namespace,
      goal: taskKey,
      reasoning: carriedReasoning,
    });

    return {
      runId,
      taskKey,
      fingerprint: fp,
      state: run,
    };
  }

  /**
   * Checks policy and cyclic anomalies before an LLM call or expensive step.
   * If approval is required, invokes `onApprovalRequired` callback.
   */
  async plan(runContext, proposedCall = {}) {
    const policy = { budgetUsd: this.maxBudgetUsd };
    const plan = planStep({
      policy,
      run: runContext.state,
      proposedCall,
      approvalThresholdUsd: this.approvalThresholdUsd,
    });

    runContext.state = reduceRun(runContext.state, {
      type: 'PLAN',
      plan,
      proposedCall,
    }, new Date().toISOString());

    if (runContext.state.status === RUN.PAUSED && typeof this.onApprovalRequired === 'function') {
      const card = buildApprovalCard(runContext.state, runContext.state.pending);
      const decision = await this.onApprovalRequired(card, runContext.state.pending);
      runContext.state = reduceRun(runContext.state, {
        type: 'RESUME',
        decision: decision === 'reject' ? 'reject' : 'approve',
      }, new Date().toISOString());
    }

    return {
      action: runContext.state.status === RUN.RUNNING ? 'proceed' : runContext.state.status,
      plan,
      runState: runContext.state,
    };
  }

  /**
   * Executes a tool inside the safe sandbox, bounding output size and isolating errors.
   * Pre-scans arguments for SSRF and template injections.
   */
  async executeTool(runContext, toolName, args = {}) {
    const sanitization = sanitizeToolArguments(args);
    if (!sanitization.safe) {
      const blockedResult = {
        success: false,
        output: `Execution blocked by GroundedVerifier: ${sanitization.violations.join('; ')}`,
        truncated: false,
        durationMs: 0,
        error: sanitization.violations[0],
      };
      runContext.state = reduceRun(runContext.state, {
        type: 'TOOL_EXECUTE',
        toolCall: { tool: toolName, args },
        toolResult: blockedResult,
      }, new Date().toISOString());
      return blockedResult;
    }

    const toolCall = {
      tool: toolName,
      args,
      maxOutputChars: this.maxObservationChars,
    };

    const toolResult = await runSandboxTool(toolCall, this.customTools);

    runContext.state = reduceRun(runContext.state, {
      type: 'TOOL_EXECUTE',
      toolCall,
      toolResult,
    }, new Date().toISOString());

    return toolResult;
  }

  /**
   * Records execution outcome, token counts, calculates verifiable savings,
   * and emits a signed GroundedReceipt.
   */
  recordStep(runContext, executionResult = {}, reasoningDelta = null) {
    runContext.state = reduceRun(runContext.state, {
      type: 'EXECUTE',
      result: executionResult,
      reasoningDelta,
    }, new Date().toISOString());

    const receipt = createGroundedReceipt({
      runId: runContext.runId,
      agentId: this.agentId,
      namespace: this.namespace,
      step: runContext.state.step,
      intent: runContext.taskKey,
      spentUsd: runContext.state.spentUsd,
      savedUsd: runContext.state.savedUsd,
    });

    runContext.state.receipts = [...(runContext.state.receipts || []), receipt];

    return {
      runState: runContext.state,
      receipt,
    };
  }

  /**
   * Automatically compacts conversation messages to prevent context degradation.
   */
  compactMessages(messages = []) {
    if (!this.autoCompact) {
      return { messages, compacted: false };
    }
    return compactHistory(messages, {
      maxTokens: this.maxHistoryTokens,
      keepRecentTurns: 4,
    });
  }

  /**
   * Commits findings and facts from this run into durable reasoning memory for future runs.
   */
  commitReasoning(runContext, delta = {}) {
    const fp = runContext.fingerprint;
    const now = new Date().toISOString();
    const currentState = runContext.state.reasoning || { facts: [], decisions: [], scratch: {} };
    const merged = mergeState(currentState, delta, now);

    runContext.state.reasoning = merged;
    if (this.persistReasoning) {
      this.memoryStore.set(fp, merged);
    }

    return merged;
  }

  /**
   * Marks the run as completed and returns a summary report.
   */
  completeRun(runContext) {
    runContext.state = reduceRun(runContext.state, { type: 'COMPLETE' }, new Date().toISOString());
    return {
      runId: runContext.runId,
      status: runContext.state.status,
      stepsExecuted: runContext.state.stepsExecuted,
      spentUsd: runContext.state.spentUsd,
      savedUsd: runContext.state.savedUsd,
      factsLearned: runContext.state.reasoning?.facts || [],
      decisions: runContext.state.reasoning?.decisions || [],
      toolCallsCount: runContext.state.toolCalls?.length || 0,
      isTerminal: isTerminal(runContext.state),
    };
  }
}

export function createAgentHarness(options = {}) {
  return new AgentHarness(options);
}

export default {
  AgentHarness,
  createAgentHarness,
};
