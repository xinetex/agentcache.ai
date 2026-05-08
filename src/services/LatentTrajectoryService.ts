/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL:
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file,
 * via any medium, is strictly prohibited.
 */

import { generateEmbedding } from '../lib/llm/embeddings.js';
import { driftMonitor, type LatentAnchor } from './DriftMonitor.js';
import type { Sector } from './ChaosRecoveryEngine.js';

export type SupportedSector = Sector | 'general';

export interface LatentTrajectoryPrediction {
  sector: SupportedSector;
  mode: 'anchor_guided' | 'goal_guided' | 'momentum_guided' | 'stabilized';
  currentVector: Float32Array;
  predictedVector: Float32Array;
  anchorCount: number;
  driftScore: number;
  confidence: number;
  expectedShift: number;
  collapseRisk: number;
}

export interface LatentSurpriseAssessment {
  sector: SupportedSector;
  surpriseScore: number;
  plausible: boolean;
  expectedShift: number;
  predictedShift: number;
  actualShift: number;
  predictionError: number;
  driftScore: number;
}

const SECTOR_COMPASSES: Record<SupportedSector, { exemplar: string; keywords: string[] }> = {
  finance: {
    exemplar: 'market analysis, fraud detection, risk controls, and financial reports',
    keywords: ['finance', 'bank', 'trading', 'ledger', 'payment', 'risk', 'fraud', 'market'],
  },
  legal: {
    exemplar: 'regulatory compliance, contracts, legal clauses, and policy review',
    keywords: ['legal', 'contract', 'compliance', 'regulation', 'clause', 'policy', 'law'],
  },
  healthcare: {
    exemplar: 'clinical records, diagnosis safety, HIPAA controls, and patient workflows',
    keywords: ['health', 'healthcare', 'patient', 'clinical', 'hipaa', 'medical', 'diagnosis'],
  },
  robotics: {
    exemplar: 'motion planning, inverse kinematics, actuator safety, and manipulator control',
    keywords: ['robot', 'robotics', 'manipulator', 'actuator', 'kinematics', 'trajectory', 'motion'],
  },
  biotech: {
    exemplar: 'protein binding, genomics, wet lab workflows, and biotech assays',
    keywords: ['biotech', 'protein', 'genomics', 'peptide', 'assay', 'receptor', 'binding'],
  },
  energy: {
    exemplar: 'grid stability, energy dispatch, photovoltaic surge, and infrastructure control',
    keywords: ['energy', 'grid', 'power', 'solar', 'battery', 'dispatch', 'frequency'],
  },
  general: {
    exemplar: 'software architecture, agent workflows, API execution, and knowledge routing',
    keywords: ['agent', 'workflow', 'cache', 'memory', 'execution', 'api', 'software', 'system'],
  },
};

function toFloat32Array(vector: ArrayLike<number>): Float32Array {
  return vector instanceof Float32Array ? vector : new Float32Array(Array.from(vector));
}

function cosineSimilarity(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

function averageAbsoluteDelta(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let total = 0;
  for (let i = 0; i < a.length; i++) {
    total += Math.abs(b[i] - a[i]);
  }
  return total / a.length;
}

function normalize(vector: Float32Array): Float32Array {
  let mag = 0;
  for (let i = 0; i < vector.length; i++) {
    mag += vector[i] * vector[i];
  }
  const denom = Math.sqrt(mag) || 1;
  const result = new Float32Array(vector.length);
  for (let i = 0; i < vector.length; i++) {
    result[i] = vector[i] / denom;
  }
  return result;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function relativeShiftDeviation(expectedShift: number, actualShift: number): number {
  if (expectedShift <= 0) {
    return clamp(actualShift, 0, 1);
  }

  return clamp(Math.abs(actualShift - expectedShift) / expectedShift, 0, 1);
}

function estimateCollapseRisk(vector: ArrayLike<number>): number {
  if (vector.length === 0) return 1;
  let mean = 0;
  for (let i = 0; i < vector.length; i++) mean += vector[i];
  mean /= vector.length;

  let variance = 0;
  for (let i = 0; i < vector.length; i++) {
    const diff = vector[i] - mean;
    variance += diff * diff;
  }
  variance /= vector.length;

  // Embedding vectors with almost no variance indicate unhealthy compression.
  return clamp(1 - Math.min(1, variance / 0.0025), 0, 1);
}

function blendToward(base: Float32Array, target: Float32Array, weight: number): Float32Array {
  const result = new Float32Array(base.length);
  for (let i = 0; i < base.length; i++) {
    result[i] = base[i] + (target[i] - base[i]) * weight;
  }
  return result;
}

export class LatentTrajectoryService {
  private anchorsInitialized = false;
  private readonly embedder: (text: string) => Promise<number[]>;
  private readonly monitor: typeof driftMonitor;

  constructor(options?: {
    embedder?: (text: string) => Promise<number[]>;
    monitor?: typeof driftMonitor;
  }) {
    this.embedder = options?.embedder || generateEmbedding;
    this.monitor = options?.monitor || driftMonitor;
  }

  inferSector(query: string): SupportedSector {
    const lower = String(query || '').toLowerCase();
    for (const [sector, config] of Object.entries(SECTOR_COMPASSES) as Array<[SupportedSector, { exemplar: string; keywords: string[] }]>) {
      if (sector === 'general') continue;
      if (config.keywords.some((keyword) => lower.includes(keyword))) {
        return sector;
      }
    }
    return 'general';
  }

  async predict(input: {
    query: string;
    sector?: SupportedSector;
    currentVector?: ArrayLike<number>;
    goalQuery?: string;
    previousVector?: ArrayLike<number>;
  }): Promise<LatentTrajectoryPrediction> {
    const sector = input.sector || this.inferSector(input.query);
    await this.ensureAnchors(sector);

    const currentVector = normalize(
      toFloat32Array(input.currentVector || await this.embedder(input.query))
    );

    const anchorVector = await this.getSectorCenter(sector);
    const goalVector = input.goalQuery ? normalize(new Float32Array(await this.embedder(input.goalQuery))) : null;
    const previousVector = input.previousVector ? normalize(toFloat32Array(input.previousVector)) : null;

    let predicted: Float32Array = new Float32Array(currentVector);
    let mode: LatentTrajectoryPrediction['mode'] = 'stabilized';

    if (anchorVector) {
      predicted = blendToward(predicted, anchorVector, 0.16);
      mode = 'anchor_guided';
    }

    if (goalVector) {
      predicted = blendToward(predicted, goalVector, 0.22);
      mode = 'goal_guided';
    }

    if (previousVector) {
      const momentum = new Float32Array(currentVector.length);
      for (let i = 0; i < currentVector.length; i++) {
        momentum[i] = currentVector[i] + (currentVector[i] - previousVector[i]) * 0.1;
      }
      predicted = normalize(blendToward(predicted, momentum, 0.1));
      if (mode === 'stabilized') mode = 'momentum_guided';
    }

    predicted = normalize(predicted);

    const expectedShift = averageAbsoluteDelta(currentVector, predicted);
    const driftScore =
      sector === 'general' ? 0 : await this.monitor.measureDrift(sector as Sector, Array.from(predicted));
    const collapseRisk = estimateCollapseRisk(predicted);
    const anchorCount = sector === 'general' ? 0 : this.monitor.getAnchorsForSector(sector as Sector).length;

    const confidence = clamp(
      0.52 +
        (anchorCount > 0 ? 0.12 : 0) +
        (goalVector ? 0.1 : 0) +
        (1 - driftScore) * 0.14 +
        (1 - collapseRisk) * 0.12,
      0.35,
      0.97
    );

    return {
      sector,
      mode,
      currentVector,
      predictedVector: predicted,
      anchorCount,
      driftScore,
      confidence,
      expectedShift,
      collapseRisk,
    };
  }

  async assessRealization(input: {
    query: string;
    actualQuery: string;
    sector?: SupportedSector;
    goalQuery?: string;
  }): Promise<LatentSurpriseAssessment> {
    const sector = input.sector || this.inferSector(`${input.query} ${input.actualQuery}`);
    const prediction = await this.predict({
      query: input.query,
      sector,
      goalQuery: input.goalQuery,
    });
    const actualVector = normalize(new Float32Array(await this.embedder(input.actualQuery)));
    const predictedShift = averageAbsoluteDelta(prediction.currentVector, prediction.predictedVector);
    const actualShift = averageAbsoluteDelta(prediction.currentVector, actualVector);
    const predictionError = 1 - cosineSimilarity(prediction.predictedVector, actualVector);
    const realizedDrift =
      sector === 'general' ? 0 : await this.monitor.measureDrift(sector as Sector, Array.from(actualVector));

    const shiftDeviation = relativeShiftDeviation(prediction.expectedShift, actualShift);

    const surpriseScore = clamp(
      predictionError * 0.5 + shiftDeviation * 0.35 + realizedDrift * 0.15,
      0,
      1
    );

    return {
      sector,
      surpriseScore,
      plausible: surpriseScore < 0.35,
      expectedShift: prediction.expectedShift,
      predictedShift,
      actualShift,
      predictionError,
      driftScore: realizedDrift,
    };
  }

  private async ensureAnchors(sector: SupportedSector) {
    if (this.anchorsInitialized || sector === 'general') return;
    await this.monitor.initializeDefaultAnchors(this.embedder);
    this.anchorsInitialized = true;
  }

  private async getSectorCenter(sector: SupportedSector): Promise<Float32Array | null> {
    if (sector === 'general') {
      return normalize(new Float32Array(await this.embedder(SECTOR_COMPASSES.general.exemplar)));
    }

    const anchors = this.monitor.getAnchorsForSector(sector as Sector);
    if (anchors.length === 0) {
      const fallback = await this.embedder(SECTOR_COMPASSES[sector].exemplar);
      return normalize(new Float32Array(fallback));
    }

    return normalize(this.averageAnchors(anchors));
  }

  private averageAnchors(anchors: LatentAnchor[]): Float32Array {
    const dim = anchors[0]?.embedding?.length || 0;
    const centroid = new Float32Array(dim);
    for (const anchor of anchors) {
      for (let i = 0; i < dim; i++) {
        centroid[i] += anchor.embedding[i];
      }
    }
    for (let i = 0; i < dim; i++) {
      centroid[i] /= anchors.length;
    }
    return centroid;
  }
}

export const latentTrajectoryService = new LatentTrajectoryService();
