/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 */

import { ChaosRecoveryStrategy, ChaosRecoveryInput, RecoveryPlan } from '../ChaosRecoveryEngine.js';

/**
 * EnergyChaosRecoveryStrategy
 * 
 * Strategy for the Energy sector: Grid-stabilizing, time-windowed, and protocol-heavy.
 * Prioritizes demand/generation reconciliation across grid telemetry windows.
 */
export class EnergyChaosRecoveryStrategy implements ChaosRecoveryStrategy {
  sector: "energy" = "energy";

  computePlan(input: ChaosRecoveryInput): RecoveryPlan {
    const remainingAttempts = input.maxAllowedAttempts - input.previousAttempts;
    const baseHorizon = Math.min(input.ttlMs, 900 * 1000); // Grid cycles (15 min)

    // 1. Demand Forecast / Grid Jitter
    if (input.errorKind === "stale_signal" || input.errorKind === "missing_field") {
      return {
        mode: "window_reconciliation",
        requiresHumanReview: false,
        maxRetries: remainingAttempts,
        expectedHorizonMs: baseHorizon,
        notes: "Grid telemetry window jitter. Reconciling demand forecasts across the 15-minute grid cycle."
      };
    }

    // 2. Protocol violation / Ontological gap (Invalid generation plan)
    if (input.errorKind === "inconsistent_ontology" || input.severity === "high") {
      return {
        mode: "semantic_reconstruction",
        requiresHumanReview: true,
        maxRetries: 1,
        expectedHorizonMs: baseHorizon,
        notes: "Generation asset contradiction or protocol violation. Attempting semantic realignment; grid operator review required."
      };
    }

    // Fallback: Discard and Escalate (Grid safety)
    return {
      mode: "discard_and_realign",
      requiresHumanReview: true,
      maxRetries: 0,
      expectedHorizonMs: input.ttlMs,
      notes: "Severe grid protocol failure. Escalating to dispatch center to prevent load-shedding anomalies."
    };
  }
}
