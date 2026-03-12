/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */

import { FinanceChaosRecoveryStrategy } from './recovery/FinanceRecoveryStrategy.js';
import { LegalChaosRecoveryStrategy } from './recovery/LegalRecoveryStrategy.js';
import { HealthcareChaosRecoveryStrategy } from './recovery/HealthcareRecoveryStrategy.js';
import { RoboticsChaosRecoveryStrategy } from './recovery/RoboticsRecoveryStrategy.js';
import { BiotechChaosRecoveryStrategy } from './recovery/BiotechRecoveryStrategy.js';
import { EnergyChaosRecoveryStrategy } from './recovery/EnergyRecoveryStrategy.js';

export type Sector =
  | "finance"
  | "healthcare"
  | "legal"
  | "biotech"
  | "robotics"
  | "energy";

export type RecoveryMode =
  | "syntactic_repair"        // Recompute / fix fields to match schema
  | "semantic_reconstruction" // Re-weave relations / narrative
  | "window_reconciliation"   // Reconcile across a time window
  | "discard_and_realign";    // Drop stale signal, re-align from current state

export type ErrorKind =
  | "schema_violation"
  | "missing_field"
  | "inconsistent_ontology"
  | "stale_signal"
  | "downstream_dependency";

export interface ChaosRecoveryInput {
  sector: Sector;
  ttlMs: number;
  eventAgeMs: number;
  ontologyRef?: string;
  errorKind: ErrorKind;
  previousAttempts: number;
  maxAllowedAttempts: number;
  severity: "low" | "medium" | "high" | "critical";
}

export interface RecoveryPlan {
  mode: RecoveryMode;
  requiresHumanReview: boolean;
  maxRetries: number;
  expectedHorizonMs: number; // Estimated time to stabilization
  notes?: string;
}

export interface ChaosRecoveryStrategy {
  sector: Sector;
  computePlan(input: ChaosRecoveryInput): RecoveryPlan;
}

/**
 * ChaosRecoveryEngine
 * 
 * Orchestrates domain-specific recovery strategies for Phase 13.
 * It determines whether an agentic failure should be repaired autonomously,
 * reconciled over a window, or escalated for human oversight.
 */
export class ChaosRecoveryEngine {
  private strategies = new Map<Sector, ChaosRecoveryStrategy>();

  constructor() {
    this.registerBuiltins();
  }

  private registerBuiltins() {
    this.register(new FinanceChaosRecoveryStrategy());
    this.register(new LegalChaosRecoveryStrategy());
    this.register(new HealthcareChaosRecoveryStrategy());
    this.register(new RoboticsChaosRecoveryStrategy());
    this.register(new BiotechChaosRecoveryStrategy());
    this.register(new EnergyChaosRecoveryStrategy());
  }

  /**
   * Register a new sector-specific recovery strategy.
   */
  register(strategy: ChaosRecoveryStrategy) {
    this.strategies.set(strategy.sector, strategy);
  }

  /**
   * Compute a recovery plan based on the sector and error context.
   */
  computePlan(input: ChaosRecoveryInput): RecoveryPlan {
    const strategy = this.strategies.get(input.sector);
    if (!strategy) {
      // Fallback: Conservative default (escalate unknown sectors)
      return {
        mode: "discard_and_realign",
        requiresHumanReview: true,
        maxRetries: 0,
        expectedHorizonMs: input.ttlMs,
        notes: `No strategy for sector=${input.sector}. Automatic escalation.`,
      };
    }
    return strategy.computePlan(input);
  }
}

export const chaosRecoveryEngine = new ChaosRecoveryEngine();
