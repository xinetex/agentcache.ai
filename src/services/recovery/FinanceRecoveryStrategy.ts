/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 */

import { ChaosRecoveryStrategy, ChaosRecoveryInput, RecoveryPlan } from '../ChaosRecoveryEngine.js';

/**
 * FinanceChaosRecoveryStrategy
 * 
 * Strategy for the Financial sector: Binary, schema-first, and rigid.
 * Prioritizes syntactic precision over narrative continuity.
 */
export class FinanceChaosRecoveryStrategy implements ChaosRecoveryStrategy {
  sector: "finance" = "finance";

  computePlan(input: ChaosRecoveryInput): RecoveryPlan {
    const remainingAttempts = input.maxAllowedAttempts - input.previousAttempts;

    // Escalation: Max attempts reached
    if (remainingAttempts <= 0) {
      return {
        mode: "syntactic_repair",
        requiresHumanReview: true,
        maxRetries: 0,
        expectedHorizonMs: input.ttlMs,
        notes: "Max repair attempts exhausted; human review required."
      };
    }

    // Schema/Field Issues: Strict auto-repair
    if (input.errorKind === "schema_violation" || input.errorKind === "missing_field") {
      return {
        mode: "syntactic_repair",
        requiresHumanReview: input.severity === "critical",
        maxRetries: remainingAttempts,
        expectedHorizonMs: Math.min(5000, input.ttlMs),
        notes: "Recalculate exact values to satisfy financial schema. No approximation."
      };
    }

    // Fallback: Conservative escalation for ambiguity
    return {
      mode: "discard_and_realign",
      requiresHumanReview: true,
      maxRetries: 0,
      expectedHorizonMs: input.ttlMs,
      notes: `Unexpected errorKind=${input.errorKind} in finance; escalation required.`
    };
  }
}
