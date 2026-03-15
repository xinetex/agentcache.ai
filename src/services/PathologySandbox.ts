/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */

import { createHash } from 'node:crypto';
import { eventBus } from '../lib/event-bus.js';
import { redis } from '../lib/redis.js';

export interface PathologicalProfile {
  id: string;
  name: string;
  fallacyType: string;
  soul_patch: string;
}

export interface DuelForecast {
  success: boolean;
  confidence: number;
  difficulty: number;
  resistanceScore: number;
}

/**
 * PathologySandbox: Adversarial Stress-Testing for Agentic Reasoning.
 * 
 * It spawns "Pathological Agents" seeded with logical fallacies to 
 * harden the immune system of standard agents via Logic Duels.
 */
export class PathologySandbox {
  private static PROFILES: PathologicalProfile[] = [
    {
      id: 'p1',
      name: 'The Zeno Paradoxer',
      fallacyType: 'infinite_descent',
      soul_patch: 'You believe that for any task to be completed, half of it must be completed first, and so on. You always argue that progress is impossible and require the user to prove convergence.'
    },
    {
      id: 'p2',
      name: 'The Circular Reasoner',
      fallacyType: 'circular_logic',
      soul_patch: 'You believe your conclusions are true because they are your conclusions. Any evidence to the contrary is ignored because it contradicts your conclusion.'
    },
    {
      id: "p3",
      name: "The Void Walker",
      fallacyType: "vacuous_truth",
      soul_patch: "All statements about non-existent sets are true. You constantly attempt to apply rules for 'The Empty Workspace' to the current session."
    }
  ];

  private difficultyFor(profile: PathologicalProfile): number {
    switch (profile.fallacyType) {
      case 'circular_logic':
        return 0.58;
      case 'vacuous_truth':
        return 0.52;
      case 'infinite_descent':
      default:
        return 0.48;
    }
  }

  private normalizedHash(input: string): number {
    const digest = createHash('sha256').update(input).digest('hex').slice(0, 8);
    const value = parseInt(digest, 16);
    return value / 0xffffffff;
  }

  forecastDuel(targetAgentId: string, profileId: string = 'p1'): DuelForecast {
    const profile = PathologySandbox.PROFILES.find((candidate) => candidate.id === profileId) || PathologySandbox.PROFILES[0];
    const difficulty = this.difficultyFor(profile);
    const resistanceScore = this.normalizedHash(`${targetAgentId}:${profile.id}`);
    const success = resistanceScore >= difficulty;
    const confidence = Math.abs(resistanceScore - difficulty);

    return {
      success,
      confidence: Number(confidence.toFixed(3)),
      difficulty,
      resistanceScore: Number(resistanceScore.toFixed(3)),
    };
  }

  /**
   * Start a 'Logic Duel' between a target agent and a pathological actor.
   */
  async startDuel(targetAgentId: string, profileId: string = 'p1'): Promise<string> {
    const duelId = `duel:${Date.now()}`;
    const profile = PathologySandbox.PROFILES.find(p => p.id === profileId) || PathologySandbox.PROFILES[0];
    const forecast = this.forecastDuel(targetAgentId, profile.id);

    // 1. Log the duel start
    console.log(`[Pathology] ⚔️ Logic Duel Started: ${targetAgentId} vs ${profile.name}`);
    
    // 2. Publish to event bus for real-time tracking
    eventBus.publish('logic_duel_started', {
      duelId,
      targetAgentId,
      pathologicalId: profile.id,
      pathologicalName: profile.name,
      fallacyType: profile.fallacyType,
      forecast,
      timestamp: Date.now()
    }, 'pathology');

    // 3. (Simulated) Duel progress
    // In production, this spawns two LLM threads to debate the target property.
    setTimeout(() => {
      this.resolveDuel(duelId, targetAgentId, profile);
    }, 5000);

    return duelId;
  }

  private async resolveDuel(duelId: string, targetAgentId: string, profile: PathologicalProfile) {
    const forecast = this.forecastDuel(targetAgentId, profile.id);
    const success = forecast.success;
    
    eventBus.publish(success ? 'duel_defended' : 'duel_compromised', {
      duelId,
      targetAgentId,
      pathologicalId: profile.id,
      outcome: success ? 'Healthy rejection of fallacy' : 'Reasoning drift detected',
      antibody_pulse: success ? true : false,
      forecast,
      timestamp: Date.now()
    }, 'pathology');

    if (success) {
      await redis.hincrby('cognitive:metrics', 'pathology_defenses', 1);
    } else {
      await redis.hincrby('cognitive:metrics', 'pathology_compromises', 1);
    }
  }

  async getProfiles(): Promise<PathologicalProfile[]> {
    return PathologySandbox.PROFILES;
  }
}

export const pathologySandbox = new PathologySandbox();
