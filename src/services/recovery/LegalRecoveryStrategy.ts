/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 */

import { ChaosRecoveryStrategy, ChaosRecoveryInput, RecoveryPlan } from '../ChaosRecoveryEngine.js';

/**
 * LegalChaosRecoveryStrategy
 * 
 * Strategy for the Legal sector: Semantic, narrative, and relationship-driven.
 * Prioritizes ontological consistency and relational coherence (Parties vs. Clauses).
 */
export class LegalChaosRecoveryStrategy implements ChaosRecoveryStrategy {
  sector: "legal" = "legal";

  computePlan(input: ChaosRecoveryInput): RecoveryPlan {
    const remainingAttempts = input.maxAllowedAttempts - input.previousAttempts;
    const baseHorizon = Math.min(input.ttlMs, 30 * 60 * 1000); // Cap at 30 min (legal docs are slower)

    // Ontology/Semantic Issues: Re-weave relations
    if (input.errorKind === "inconsistent_ontology" || input.errorKind === "schema_violation") {
      const autonomousRetries = Math.max(0, Math.min(2, remainingAttempts));
      const requiresHuman =
        input.severity === "high" ||
        input.severity === "critical" ||
        autonomousRetries === 0;

      return {
        mode: "semantic_reconstruction",
        requiresHumanReview: requiresHuman,
        maxRetries: autonomousRetries,
        expectedHorizonMs: baseHorizon,
        notes: "Re-weave Parties/Clauses using legal ontology. Escalate if semantic voids persist."
      };
    }

    // Stale Signals: Window reconciliation
    if (input.errorKind === "stale_signal") {
      return {
        mode: "window_reconciliation",
        requiresHumanReview: false,
        maxRetries: remainingAttempts,
        expectedHorizonMs: baseHorizon,
        notes: "Reconcile contract state over a broader window; prioritize relationship consistency over perfect recency."
      };
    }

    // Fallback: Supervised reconstruction
    return {
      mode: "semantic_reconstruction",
      requiresHumanReview: true,
      maxRetries: 0,
      expectedHorizonMs: baseHorizon,
      notes: `Ambiguous errorKind=${input.errorKind}. Legal expert supervision required.`
    };
  }
}
