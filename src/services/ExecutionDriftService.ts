import { randomUUID } from 'node:crypto';
import { redis } from '../lib/redis.js';
import { executionControlService, type ExecutionRunBundle } from './ExecutionControlService.js';
import { latentTrajectoryService } from './LatentTrajectoryService.js';

const RETENTION_SECONDS = 90 * 24 * 60 * 60;
const EVALUATION_INDEX_KEY = 'execution:drift-evaluations:index';

export type DriftEvaluationMode = 'shadow';
export type DriftEvaluationVerdict = 'stable' | 'watch' | 'drifting';

export interface ExecutionDriftEvaluationRecord {
  id: string;
  runId: string;
  contextPackId: string;
  contextPackVersionId: string;
  mode: DriftEvaluationMode;
  verdict: DriftEvaluationVerdict;
  sector: string;
  expectedQuery: string;
  actualQuery: string;
  expectedPhase: string;
  actualPhase: string;
  reviewVerdict: string;
  surpriseScore: number;
  driftScore: number;
  predictionError: number;
  expectedShift: number;
  actualShift: number;
  plausible: boolean;
  notes: string[];
  createdAt: string;
}

function evaluationKey(id: string) {
  return `execution:drift-evaluation:${id}`;
}

function runEvaluationIndexKey(runId: string) {
  return `execution:run:${runId}:drift-evaluations`;
}

function compactJson(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function summarizeExpected(bundle: ExecutionRunBundle) {
  const version = bundle.contextPackVersion;
  const run = bundle.run;
  return [
    `Objective: ${version.objective}`,
    version.methodology ? `Methodology: ${version.methodology}` : '',
    `Expected phase order: ${version.workflowPhases.join(' -> ')}`,
    `Current phase target: ${run.phasePlan[Math.min(run.completedPhases.length + 1, run.phasePlan.length - 1)] || run.currentPhase}`,
    `Required reviewers: ${run.requiredReviewerRoles.join(', ') || 'none'}`,
    `Policy mode: ${version.policy.evidenceMode}`,
    `Trigger: ${run.trigger}`,
  ].filter(Boolean).join('\n');
}

function summarizeActual(bundle: ExecutionRunBundle) {
  const run = bundle.run;
  const reviews = bundle.reviews.map((review) => `${review.reviewerRole}:${review.verdict}:${review.summary || ''}`).join(' | ');
  return [
    `Actual phase: ${run.currentPhase}`,
    `Completed phases: ${run.completedPhases.join(' -> ') || 'none'}`,
    `Review verdict: ${run.reviewVerdict}`,
    `Completed reviewers: ${run.completedReviewerRoles.join(', ') || 'none'}`,
    reviews ? `Reviews: ${reviews}` : '',
    run.gateStatus ? `Gate status: ${run.gateStatus}` : '',
    run.notes.slice(-4).join(' '),
    compactJson(run.inputPayload),
    compactJson(run.outputPayload),
  ].filter(Boolean).join('\n');
}

function inferExpectedPhase(bundle: ExecutionRunBundle) {
  const run = bundle.run;
  if (run.reviewVerdict === 'BLOCK') return 'blocked';
  if (run.completedReviewerRoles.length < run.requiredReviewerRoles.length) return 'review';
  if (run.gateStatus === 'pending') return 'gate';
  return run.phasePlan[run.phasePlan.length - 1] || run.currentPhase;
}

function buildNotes(bundle: ExecutionRunBundle, expectedPhase: string, surpriseScore: number, plausible: boolean) {
  const notes: string[] = [];
  if (bundle.run.currentPhase !== expectedPhase) {
    notes.push(`Run is in ${bundle.run.currentPhase} while expected workflow phase is ${expectedPhase}.`);
  }
  if (bundle.run.completedReviewerRoles.length < bundle.run.requiredReviewerRoles.length) {
    const missing = bundle.run.requiredReviewerRoles.filter((role) => !bundle.run.completedReviewerRoles.includes(role));
    notes.push(`Missing reviewer roles: ${missing.join(', ')}.`);
  }
  if (!plausible) {
    notes.push(`Latent trajectory surprise exceeded threshold (${surpriseScore.toFixed(3)}).`);
  }
  if (bundle.gate?.status === 'pending') {
    notes.push('Human approval gate remains pending.');
  }
  return notes;
}

export class ExecutionDriftService {
  async evaluateRun(runId: string, mode: DriftEvaluationMode = 'shadow') {
    const bundle = await executionControlService.getRunBundle(runId);
    if (!bundle) {
      throw new Error('Execution run not found.');
    }

    const expectedQuery = summarizeExpected(bundle);
    const actualQuery = summarizeActual(bundle);
    const expectedPhase = inferExpectedPhase(bundle);
    const actualPhase = bundle.run.currentPhase;
    const assessment = await latentTrajectoryService.assessRealization({
      query: expectedQuery,
      actualQuery,
      sector: (bundle.contextPackVersion.ontology.sectorId as any) || undefined,
    });

    const surpriseScore = assessment.surpriseScore;
    const verdict: DriftEvaluationVerdict =
      surpriseScore >= 0.6 || actualPhase === 'blocked'
        ? 'drifting'
        : surpriseScore >= 0.3
          ? 'watch'
          : 'stable';

    const createdAt = new Date().toISOString();
    const record: ExecutionDriftEvaluationRecord = {
      id: `xdrift_${randomUUID()}`,
      runId: bundle.run.id,
      contextPackId: bundle.contextPack.id,
      contextPackVersionId: bundle.contextPackVersion.id,
      mode,
      verdict,
      sector: assessment.sector,
      expectedQuery,
      actualQuery,
      expectedPhase,
      actualPhase,
      reviewVerdict: bundle.run.reviewVerdict,
      surpriseScore,
      driftScore: assessment.driftScore,
      predictionError: assessment.predictionError,
      expectedShift: assessment.expectedShift,
      actualShift: assessment.actualShift,
      plausible: assessment.plausible,
      notes: buildNotes(bundle, expectedPhase, surpriseScore, assessment.plausible),
      createdAt,
    };

    await Promise.all([
      redis.setex(evaluationKey(record.id), RETENTION_SECONDS, JSON.stringify(record)),
      redis.zadd(EVALUATION_INDEX_KEY, { score: Date.parse(createdAt) || Date.now(), member: record.id }),
      redis.zadd(runEvaluationIndexKey(runId), { score: Date.parse(createdAt) || Date.now(), member: record.id }),
      redis.expire(EVALUATION_INDEX_KEY, RETENTION_SECONDS),
      redis.expire(runEvaluationIndexKey(runId), RETENTION_SECONDS),
    ]);

    return record;
  }

  async getEvaluation(id: string): Promise<ExecutionDriftEvaluationRecord | null> {
    const raw = await redis.get(evaluationKey(id));
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) as ExecutionDriftEvaluationRecord : raw as ExecutionDriftEvaluationRecord;
  }

  async listRunEvaluations(runId: string, limit: number = 25): Promise<ExecutionDriftEvaluationRecord[]> {
    const ids = (await redis.zrange(runEvaluationIndexKey(runId), 0, -1, { rev: true })).map(String).slice(0, limit);
    const records: ExecutionDriftEvaluationRecord[] = [];
    for (const id of ids) {
      const record = await this.getEvaluation(id);
      if (record) records.push(record);
    }
    return records;
  }

  async getSummary(limit: number = 5) {
    const ids = (await redis.zrange(EVALUATION_INDEX_KEY, 0, -1, { rev: true })).map(String);
    const recentIds = ids.slice(0, limit);
    const records: ExecutionDriftEvaluationRecord[] = [];
    for (const id of recentIds) {
      const record = await this.getEvaluation(id);
      if (record) records.push(record);
    }

    const allRecords: ExecutionDriftEvaluationRecord[] = [];
    for (const id of ids) {
      const record = await this.getEvaluation(id);
      if (record) allRecords.push(record);
    }

    const total = allRecords.length;
    const stable = allRecords.filter((record) => record.verdict === 'stable').length;
    const watch = allRecords.filter((record) => record.verdict === 'watch').length;
    const drifting = allRecords.filter((record) => record.verdict === 'drifting').length;
    const averageSurpriseScore = total > 0
      ? allRecords.reduce((sum, record) => sum + record.surpriseScore, 0) / total
      : 0;

    return {
      totalEvaluations: total,
      stableEvaluations: stable,
      watchEvaluations: watch,
      driftingEvaluations: drifting,
      averageSurpriseScore,
      recentEvaluations: records.map((record) => ({
        id: record.id,
        runId: record.runId,
        verdict: record.verdict,
        actualPhase: record.actualPhase,
        expectedPhase: record.expectedPhase,
        surpriseScore: record.surpriseScore,
        createdAt: record.createdAt,
      })),
    };
  }
}

export const executionDriftService = new ExecutionDriftService();
