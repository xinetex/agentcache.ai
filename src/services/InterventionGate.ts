/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 */

import { Sector } from './ChaosRecoveryEngine.js';
import { reputationService } from './ReputationService.js';

/**
 * InterventionContext
 * 
 * Contextual data used by the gate to assess risk and determine 
 * if a signal requires human or automated review.
 */
export interface InterventionContext {
  agentId: string;
  personaId?: string;
  sector: Sector | string;
  taskType: string;              // e.g. "tool_call", "draft_contract", "trade_execution"
  riskLevel: "low" | "medium" | "high" | "critical"; 
  reputation: number;            // 0..1 from ReputationService
  cogCost: number;               // 0..1 cognitive cost estimate
  driftScore: number;            // 0..1 semantic drift from DriftMonitor
  chaosMode: "normal" | "provocation" | "recovery";
  recentOverrideRate: number;    // 0..1 in sliding window
  recentErrorRate: number;       // 0..1 cognitive error rate
  extras?: Record<string, number | string | boolean>;
}

export type InterventionAction =
  | "allow"        // proceed normally
  | "soft_review"  // log prominently / extra telemetry / maybe async check
  | "hard_review"; // require sync approval / stricter policy

export interface InterventionDecision {
  riskScore: number;  // 0..1
  action: InterventionAction;
  featureContributions?: Record<string, number>;
}

/**
 * RiskScorer Interface
 * 
 * Pluggable architecture to allow swapping heuristic scorers for ML models.
 */
export interface RiskScorer {
  score(ctx: InterventionContext): InterventionDecision;
}

/**
 * HeuristicRiskScorer (v1)
 * 
 * Implements a weighted-sum heuristic to assess risk.
 */
export class HeuristicRiskScorer implements RiskScorer {
  score(ctx: InterventionContext): InterventionDecision {
    const f: Record<string, number> = {};

    // base from risk level
    const riskLevelBase: Record<string, number> = {
      low: 0.1,
      medium: 0.3,
      high: 0.6,
      critical: 0.8,
    };
    f.riskLevel = riskLevelBase[ctx.riskLevel] ?? 0.3;

    // higher cogCost -> higher risk
    f.cogCost = ctx.cogCost; // already 0..1

    // low reputation -> higher risk
    f.reputation = 1 - ctx.reputation; // invert

    // semantic drift contribution
    f.drift = ctx.driftScore;

    // recent overrides / errors
    f.override = ctx.recentOverrideRate;
    f.error = ctx.recentErrorRate;

    // Phase 16: Collective Trust Boost
    // If the whole sector is suffering, we increase individual risk.
    const sectorHealth = reputationService.getSectorReputation(ctx.sector);
    if (sectorHealth.status === 'critical') f.collectiveDrift = 0.4;
    else if (sectorHealth.status === 'degrading') f.collectiveDrift = 0.2;
    else f.collectiveDrift = 0;

    // chaos mode boost
    f.chaos =
      ctx.chaosMode === "provocation" ? 0.2 :
      ctx.chaosMode === "recovery" ? 0.1 :
      0;

    // simple weighted sum (Phase 15/16 tuneable weights)
    const weights: Record<string, number> = {
      riskLevel: 0.25,
      cogCost: 0.15,
      reputation: 0.15,
      drift: 0.15,
      override: 0.1,
      error: 0.05,
      chaos: 0.05,
      collectiveDrift: 0.1, // New Phase 16 weight
    };

    let raw = 0;
    let totalW = 0;
    for (const key in f) {
      const w = weights[key] ?? 0;
      raw += f[key] * w;
      totalW += w;
    }
    const riskScore = Math.min(1, Math.max(0, raw / (totalW || 1)));

    // map riskScore to action
    let action: InterventionAction;
    if (riskScore < 0.3) action = "allow";
    else if (riskScore < 0.7) action = "soft_review";
    else action = "hard_review";

    return { riskScore, action, featureContributions: f };
  }
}

/**
 * InterventionGate
 * 
 * The central decision gate for Phase 15. Orchestrates risk assessment
 * and maps scores to actionable outcomes (allow, review, etc.).
 */
export class InterventionGate {
  constructor(
    private scorer: RiskScorer = new HeuristicRiskScorer(),
    private hardReviewThreshold: number = 0.7,
    private softReviewThreshold: number = 0.3,
  ) {}

  assess(ctx: InterventionContext): InterventionDecision {
    const decision = this.scorer.score(ctx);

    // Re-map thresholds centrally for policy-level control
    let action: InterventionAction;
    if (decision.riskScore < this.softReviewThreshold) {
      action = "allow";
    } else if (decision.riskScore < this.hardReviewThreshold) {
      action = "soft_review";
    } else {
      action = "hard_review";
    }

    return { ...decision, action };
  }
}

export const interventionGate = new InterventionGate();
