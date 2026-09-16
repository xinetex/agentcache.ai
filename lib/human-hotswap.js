// lib/human-hotswap.js
//
// AgentCache — Human Hot-Swap & Operational Interoperability Protocol.
//
// Solves the "Cognitive Shock" problem: allows human operators to seamlessly inspect
// active multi-agent runs, read fully decompiled plain-English briefings, and take over
// execution without deciphering synthetic argots.
//
// Pure, deterministic, and engine-agnostic.

import { globalRosettaBridge } from './rosetta-bridge.js';

export class HumanHotSwap {
  /**
   * Generates a 30-second human briefing from an active run context.
   * Decompiles all synthetic tokens into plain English and extracts clear facts.
   */
  static generateBriefing(runContext = {}, bridge = globalRosettaBridge) {
    const state = runContext.state || runContext;
    const history = state.history || [];
    const facts = state.reasoning?.facts || [];
    const decisions = state.reasoning?.decisions || [];

    // Decompile the last 5 messages/turns for the human
    const recentTurns = (state.toolResults || []).slice(-5).map(tr => {
      const decompiled = bridge.decompile(typeof tr.output === 'string' ? tr.output : JSON.stringify(tr));
      return {
        original: tr.output,
        humanReadable: decompiled.decompiled,
        expandedTerms: decompiled.expandedTerms,
      };
    });

    return {
      runId: state.runId,
      agentId: state.agentId,
      goal: state.goal || 'General task execution',
      currentStep: state.step || 0,
      status: state.status,
      spentUsd: state.spentUsd || 0,
      savedUsd: state.savedUsd || 0,
      executiveSummary: `Agent [${state.agentId}] is at step ${state.step || 0} (${state.status.toUpperCase()}) with $${state.spentUsd || 0} spent.`,
      knownFacts: facts,
      agreedDecisions: decisions,
      recentActivity: recentTurns,
      hotSwapReady: true,
    };
  }

  /**
   * Executes a human takeover of the run context.
   */
  static executeTakeover(runContext, operator = {}) {
    const state = runContext.state || runContext;
    const operatorId = operator.id || operator.name || 'human_operator_1';

    state.operator = {
      type: 'HUMAN',
      operatorId,
      swappedAt: new Date().toISOString(),
      originalAgentId: state.agentId,
    };

    state.status = 'human_controlled';

    return {
      success: true,
      swappedAt: state.operator.swappedAt,
      message: `Human operator [${operatorId}] has assumed direct control of run ${state.runId}.`,
      runState: state,
    };
  }
}

export default {
  HumanHotSwap,
};
