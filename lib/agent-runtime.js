// lib/agent-runtime.js
//
// AgentCache — Background Agent Runtime (the control-plane state machine).
//
// This is the "platform" layer: it turns the three moat pieces — governance
// gate (lib/governance.js), savings ledger (lib/savings*.js), and reasoning
// memory (lib/reasoning-cache.js) — into a single GOVERNED, DURABLE, HUMAN-IN-
// THE-LOOP execution model for long-running background agents.
//
// Deliberately ENGINE-AGNOSTIC and side-effect-free. Durability and event
// waiting are RENTED from Inngest (src/inngest/functions/agent-run.ts); the
// hard-won correctness — when to allow a step, when to pause for a human, when
// to kill a runaway, and how reasoning state carries across checkpoints — lives
// here, as a pure reducer that replays identically. That is the subtraction
// discipline: own the moat, rent the commodity.

import { decide } from './governance.js';
import { getPrice, round2 } from './savings.js';
import { savingsFromHit } from './savings-recorder.js';
import { mergeState } from './reasoning-cache.js';

export const RUN = {
  RUNNING: 'running',
  PAUSED: 'paused',     // waiting on a human decision
  BLOCKED: 'blocked',   // hard policy denial (budget/quota/kill)
  COMPLETED: 'completed',
  KILLED: 'killed',
};

// Price a proposed model call (0 for an unknown model — never fabricate a cost).
export function estimateCostUsd(proposedCall = {}) {
  const price = getPrice(proposedCall.model);
  if (!price) return { estCostUsd: 0, priced: false };
  const inTok = proposedCall.inputTokens || 0;
  const outTok = proposedCall.outputTokens || 0;
  return { estCostUsd: round2(inTok * (price.in / 1e6) + outTok * (price.out / 1e6)), priced: true };
}

// PURE: should this proposed step be allowed / paused / blocked, given the
// org policy and the run's spend so far?
export function planStep({ policy = {}, run = {}, proposedCall = {}, approvalThresholdUsd = 0 } = {}) {
  const { estCostUsd, priced } = estimateCostUsd(proposedCall);
  const verdict = decide(policy, {
    spentUsd: run.spentUsd || 0,
    usedRequests: run.stepsExecuted || 0,
    estCostUsd,
    series: run.series || [],
  });

  // Hard block wins (budget exceeded / quota / kill-switch).
  if (!verdict.allow) {
    return { action: 'block', estCostUsd, priced, verdict, reasons: verdict.reasons };
  }
  // Pause for a human when: policy is warning (near budget), the call is flagged
  // for approval, or the single call is above the approval threshold.
  const needsHuman =
    verdict.severity === 'warn' ||
    proposedCall.requiresApproval === true ||
    (approvalThresholdUsd > 0 && estCostUsd >= approvalThresholdUsd);
  return { action: needsHuman ? 'pause' : 'proceed', estCostUsd, priced, verdict, reasons: verdict.reasons };
}

export function initRun({ runId, agentId = 'default', namespace = 'default', reasoning = null, series = [] } = {}) {
  return {
    runId,
    agentId,
    namespace,
    status: RUN.RUNNING,
    step: 0,
    stepsExecuted: 0,
    spentUsd: 0,
    savedUsd: 0,
    series,
    reasoning: reasoning && typeof reasoning === 'object' ? reasoning : { facts: [], decisions: [], scratch: {}, runs: 0 },
    ledger: [],       // savings rows to persist (drained by the executor)
    pending: null,    // {proposedCall, plan} while PAUSED
    history: [],
  };
}

// PURE, TOTAL reducer. Same (state,event) → same next state, so an Inngest
// replay after a crash reconstructs the run exactly. `now` injected for purity.
export function reduceRun(state, event = {}, now = null) {
  const s = { ...state, history: [...(state.history || []), { t: event.type, at: now }] };
  switch (event.type) {
    case 'PLAN': {
      // event.plan from planStep(). Decide the run's next status.
      if (s.status !== RUN.RUNNING) return s;
      if (event.plan.action === 'block') {
        return { ...s, status: RUN.BLOCKED, pending: { proposedCall: event.proposedCall, plan: event.plan } };
      }
      if (event.plan.action === 'pause') {
        return { ...s, status: RUN.PAUSED, pending: { proposedCall: event.proposedCall, plan: event.plan } };
      }
      return { ...s, pending: { proposedCall: event.proposedCall, plan: event.plan } }; // proceed
    }
    case 'RESUME': {
      // Human decision on a paused run.
      if (s.status !== RUN.PAUSED) return s;
      if (event.decision === 'approve') return { ...s, status: RUN.RUNNING };
      return { ...s, status: RUN.KILLED, pending: null }; // reject ends the run
    }
    case 'EXECUTE': {
      // event.result = { model, layer?, inputTokens, outputTokens, costUsd }
      if (s.status !== RUN.RUNNING || !s.pending) return s;
      const r = event.result || {};
      const cost = round2(r.costUsd || s.pending.plan.estCostUsd || 0);
      // Value any cache reuse on this step for the savings ledger.
      const saved = r.layer ? savingsFromHit({ layer: r.layer, model: r.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens, prefixTokens: r.prefixTokens }) : null;
      const ledger = saved && saved.savedUsd > 0
        ? [...s.ledger, { ...saved, step: s.step, agentId: s.agentId }]
        : s.ledger;
      return {
        ...s,
        step: s.step + 1,
        stepsExecuted: s.stepsExecuted + 1,
        spentUsd: round2((s.spentUsd || 0) + cost),
        savedUsd: round2((s.savedUsd || 0) + (saved ? saved.savedUsd : 0)),
        reasoning: event.reasoningDelta ? mergeState(s.reasoning, event.reasoningDelta, now) : s.reasoning,
        ledger,
        pending: null,
      };
    }
    case 'KILL':
      return { ...s, status: RUN.KILLED, pending: null };
    case 'COMPLETE':
      return s.status === RUN.RUNNING ? { ...s, status: RUN.COMPLETED, pending: null } : s;
    default:
      return s;
  }
}

// Durable checkpoint = the run state minus replayable history. Restore is the
// inverse. State is already plain JSON, so this is trivial + stable.
export function checkpoint(state) {
  const { history, ...durable } = state;
  return durable;
}
export function restore(chk) {
  return { ...chk, history: [] };
}

export function isTerminal(state) {
  return [RUN.COMPLETED, RUN.KILLED, RUN.BLOCKED].includes(state.status);
}

export default {
  RUN, estimateCostUsd, planStep, initRun, reduceRun, checkpoint, restore, isTerminal,
};
