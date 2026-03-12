/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 */

import { ChaosRecoveryStrategy, ChaosRecoveryInput, RecoveryPlan } from '../ChaosRecoveryEngine.js';

/**
 * HealthcareChaosRecoveryStrategy
 * 
 * Strategy for the Healthcare sector: Safety-first, clinical, and conservative.
 * Prioritizes patient safety and data integrity over speed.
 */
export class HealthcareChaosRecoveryStrategy implements ChaosRecoveryStrategy {
  sector: "healthcare" = "healthcare";

  computePlan(input: ChaosRecoveryInput): RecoveryPlan {
    // 1. Critical Policy: Patient Safety
    // Any ontological inconsistency in clinical data triggers immediate escalation.
    if (input.errorKind === "inconsistent_ontology" || input.severity === "critical") {
      return {
        mode: "discard_and_realign",
        requiresHumanReview: true,
        maxRetries: 0,
        expectedHorizonMs: input.ttlMs,
        notes: "SAFETY ALERT: Critical clinical inconsistency or high-severity error. Manual audit required."
      };
    }

    // 2. Minor schema issues: Limited auto-repair
    if (input.errorKind === "schema_violation" || input.errorKind === "missing_field") {
      return {
        mode: "syntactic_repair",
        requiresHumanReview: true, // Always review in healthcare
        maxRetries: 1, // At most one auto-fix attempt
        expectedHorizonMs: Math.min(10000, input.ttlMs),
        notes: "Standard schema violation. Attempting single autonomous fix before mandatory human review."
      };
    }

    // Fallback: Discard and Escalate
    return {
      mode: "discard_and_realign",
      requiresHumanReview: true,
      maxRetries: 0,
      expectedHorizonMs: input.ttlMs,
      notes: "Unexpected clinical data failure. Discarding signal to prevent corruption; requiring expert review."
    };
  }
}
