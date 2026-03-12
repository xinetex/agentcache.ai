/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 */

import { ChaosRecoveryStrategy, ChaosRecoveryInput, RecoveryPlan } from '../ChaosRecoveryEngine.js';

/**
 * RoboticsChaosRecoveryStrategy
 * 
 * Strategy for the Robotics sector: High-velocity, real-time, and jitter-tolerant.
 * Prioritizes state realignment over historical reconstruction.
 */
export class RoboticsChaosRecoveryStrategy implements ChaosRecoveryStrategy {
  sector: "robotics" = "robotics";

  computePlan(input: ChaosRecoveryInput): RecoveryPlan {
    const remainingAttempts = input.maxAllowedAttempts - input.previousAttempts;

    // 1. High Jitter / Latency Issues
    // For stale signals or missing kinematics fields, discard and wait for next burst.
    if (input.errorKind === "stale_signal" || input.errorKind === "missing_field" || input.eventAgeMs > input.ttlMs) {
      return {
        mode: "discard_and_realign",
        requiresHumanReview: false,
        maxRetries: remainingAttempts,
        expectedHorizonMs: 200, // Robotics recovers in milliseconds
        notes: "Sensor jitter or stale kinematics detected. Discarding stale state and realigning to the next telemetry burst."
      };
    }

    // 2. Ontological inconsistencies (e.g. invalid task plan)
    if (input.errorKind === "inconsistent_ontology") {
      return {
        mode: "syntactic_repair",
        requiresHumanReview: input.severity === "high" || input.severity === "critical",
        maxRetries: 1,
        expectedHorizonMs: 1000,
        notes: "Invalid task plan or kinematic constraint. Attempting one-shot syntactic realignment."
      };
    }

    // Fallback: Discard and Escalate (To prevent hardware damage)
    return {
      mode: "discard_and_realign",
      requiresHumanReview: true,
      maxRetries: 0,
      expectedHorizonMs: input.ttlMs,
      notes: "Hardware-critical error or severe data corruption. Emergency halt / Human review required."
    };
  }
}
