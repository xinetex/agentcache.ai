/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 */

import { ChaosRecoveryStrategy, ChaosRecoveryInput, RecoveryPlan } from '../ChaosRecoveryEngine.js';

/**
 * BiotechChaosRecoveryStrategy
 * 
 * Strategy for the Biotech/Pharma sector: Experimental, longitudinal, and precision-focused.
 * Prioritizes window reconciliation across trial phases.
 */
export class BiotechChaosRecoveryStrategy implements ChaosRecoveryStrategy {
  sector: "biotech" = "biotech";

  computePlan(input: ChaosRecoveryInput): RecoveryPlan {
    const remainingAttempts = input.maxAllowedAttempts - input.previousAttempts;
    const baseHorizon = Math.min(input.ttlMs, 24 * 60 * 60 * 1000); // Biotech windows are huge (up to 24h)

    // 1. Longitudinal Inconsistencies (Trial Phase drift)
    if (input.errorKind === "inconsistent_ontology" || input.errorKind === "stale_signal") {
      return {
        mode: "window_reconciliation",
        requiresHumanReview: input.severity === "high" || input.severity === "critical",
        maxRetries: remainingAttempts,
        expectedHorizonMs: baseHorizon,
        notes: "Experimental drift or trial phase inconsistency. Reconciling telemetry across the current treatment window."
      };
    }

    // 2. Data integrity / Schema issues
    if (input.errorKind === "schema_violation" || input.errorKind === "missing_field") {
      return {
        mode: "syntactic_repair",
        requiresHumanReview: true, // Scientific data requires auditing
        maxRetries: 1,
        expectedHorizonMs: Math.min(60000, input.ttlMs),
        notes: "Schema mismatch in sequence or trial metadata. Attempting single repair; mandatory scientific audit required."
      };
    }

    // Fallback: Discard and Escalate
    return {
      mode: "discard_and_realign",
      requiresHumanReview: true,
      maxRetries: 0,
      expectedHorizonMs: input.ttlMs,
      notes: "Severe experimental anomaly. Data quarantined for human PI (Principal Investigator) review."
    };
  }
}
