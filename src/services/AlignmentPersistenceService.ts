import { randomUUID } from 'node:crypto';
import { redis } from '../lib/redis.js';
import {
  listAlignmentPairs,
  type AlignmentPairRecord,
  type AlignmentPairStatus,
  type AlignmentTaskFamily,
} from '../lib/alignment/pair-registry.js';
import type { AlignmentRoutingDecision } from './AlignmentRoutingService.js';

const RETENTION_SECONDS = 90 * 24 * 60 * 60;
const RUN_INDEX_KEY = 'alignment:runs:index';
const BENCHMARK_INDEX_KEY = 'alignment:benchmarks:index';
const PAIR_INDEX_KEY = 'alignment:pairs:index';

function runKey(id: string) {
  return `alignment:run:${id}`;
}

function benchmarkKey(id: string) {
  return `alignment:benchmark:${id}`;
}

function pairKey(id: string) {
  return `alignment:pair:${id}`;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function countBy(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, count]) => ({ key, count }));
}

export interface StoredAlignmentRun {
  id: string;
  requestId: string;
  recordedAt: string;
  principalId?: string;
  decision: AlignmentRoutingDecision;
}

export interface AlignmentBenchmarkRecord {
  id: string;
  pairId: string;
  sourceProvider: string;
  sourceModel?: string | null;
  targetProvider: string;
  targetModel?: string | null;
  taskFamily: AlignmentTaskFamily;
  dataset?: string | null;
  baselineScore?: number | null;
  alignedScore?: number | null;
  degradationPct?: number | null;
  latencyMs?: number | null;
  costUsd?: number | null;
  notes?: string[];
  status?: 'recorded' | 'validated' | 'rejected';
  recordedAt: string;
}

export interface AlignmentPairOverrideRecord extends AlignmentPairRecord {
  updatedAt: string;
  updatedBy?: string;
}

export interface AlignmentPairUpsertInput {
  id: string;
  sourceProvider: string;
  sourceModel?: string | null;
  targetProvider: string;
  targetModel?: string | null;
  taskFamily: AlignmentTaskFamily;
  status: AlignmentPairStatus;
  compatibilityScore: number;
  tokenizerCompatibility: number;
  representationSimilarity: number;
  privateInferenceCapable: boolean;
  evidenceLevel: AlignmentPairRecord['evidenceLevel'];
  notes?: string[];
}

export interface AlignmentSummary {
  totalRuns: number;
  blockedRuns: number;
  encryptedLinearRuns: number;
  averageCompatibilityScore: number;
  validatedPairs: number;
  estimatedPairs: number;
  blockedPairs: number;
  storedBenchmarks: number;
  byExecutionMode: Array<{ mode: string; count: number }>;
  byVerdict: Array<{ verdict: string; count: number }>;
  byTaskFamily: Array<{ taskFamily: string; count: number }>;
  byTargetProvider: Array<{ provider: string; count: number }>;
  recentRuns: Array<{
    requestId: string;
    executionMode: string;
    verdict: string;
    targetProvider: string | null;
    taskFamily: string;
    compatibilityScore: number;
    recordedAt: string;
  }>;
  recentBenchmarks: AlignmentBenchmarkRecord[];
}

export class AlignmentPersistenceService {
  async recordRun(decision: AlignmentRoutingDecision, context?: { principalId?: string | null }): Promise<StoredAlignmentRun> {
    const record: StoredAlignmentRun = {
      id: decision.requestId,
      requestId: decision.requestId,
      recordedAt: new Date().toISOString(),
      principalId: context?.principalId || undefined,
      decision,
    };

    await Promise.all([
      redis.setex(runKey(record.id), RETENTION_SECONDS, JSON.stringify(record)),
      redis.zadd(RUN_INDEX_KEY, {
        score: Date.parse(record.recordedAt) || Date.now(),
        member: record.id,
      }),
      redis.expire(RUN_INDEX_KEY, RETENTION_SECONDS),
    ]);

    return record;
  }

  async getRun(id: string): Promise<StoredAlignmentRun | null> {
    const raw = await redis.get(runKey(id));
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) as StoredAlignmentRun : raw as StoredAlignmentRun;
  }

  async listRuns(limit: number = 25): Promise<StoredAlignmentRun[]> {
    const runIds = (await redis.zrange(RUN_INDEX_KEY, 0, -1, { rev: true })).map(String).slice(0, limit);
    const runs: StoredAlignmentRun[] = [];
    for (const id of runIds) {
      const record = await this.getRun(id);
      if (record) runs.push(record);
    }
    return runs;
  }

  async recordBenchmark(input: Omit<AlignmentBenchmarkRecord, 'id' | 'recordedAt'> & { id?: string }): Promise<AlignmentBenchmarkRecord> {
    const record: AlignmentBenchmarkRecord = {
      id: input.id || `bench_${randomUUID()}`,
      pairId: input.pairId,
      sourceProvider: input.sourceProvider,
      sourceModel: input.sourceModel || null,
      targetProvider: input.targetProvider,
      targetModel: input.targetModel || null,
      taskFamily: input.taskFamily,
      dataset: input.dataset || null,
      baselineScore: input.baselineScore ?? null,
      alignedScore: input.alignedScore ?? null,
      degradationPct: input.degradationPct ?? null,
      latencyMs: input.latencyMs ?? null,
      costUsd: input.costUsd ?? null,
      notes: input.notes || [],
      status: input.status || 'recorded',
      recordedAt: new Date().toISOString(),
    };

    await Promise.all([
      redis.setex(benchmarkKey(record.id), RETENTION_SECONDS, JSON.stringify(record)),
      redis.zadd(BENCHMARK_INDEX_KEY, {
        score: Date.parse(record.recordedAt) || Date.now(),
        member: record.id,
      }),
      redis.expire(BENCHMARK_INDEX_KEY, RETENTION_SECONDS),
    ]);

    return record;
  }

  async getBenchmark(id: string): Promise<AlignmentBenchmarkRecord | null> {
    const raw = await redis.get(benchmarkKey(id));
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) as AlignmentBenchmarkRecord : raw as AlignmentBenchmarkRecord;
  }

  async listBenchmarks(limit: number = 25): Promise<AlignmentBenchmarkRecord[]> {
    const benchmarkIds = (await redis.zrange(BENCHMARK_INDEX_KEY, 0, -1, { rev: true })).map(String).slice(0, limit);
    const records: AlignmentBenchmarkRecord[] = [];
    for (const id of benchmarkIds) {
      const record = await this.getBenchmark(id);
      if (record) records.push(record);
    }
    return records;
  }

  async upsertPair(input: AlignmentPairUpsertInput, context?: { updatedBy?: string | null }): Promise<AlignmentPairOverrideRecord> {
    const record: AlignmentPairOverrideRecord = {
      id: input.id,
      sourceProvider: input.sourceProvider.trim().toLowerCase(),
      sourceModel: input.sourceModel?.trim() || undefined,
      targetProvider: input.targetProvider.trim().toLowerCase(),
      targetModel: input.targetModel?.trim() || undefined,
      taskFamily: input.taskFamily,
      status: input.status,
      compatibilityScore: Number(input.compatibilityScore),
      tokenizerCompatibility: Number(input.tokenizerCompatibility),
      representationSimilarity: Number(input.representationSimilarity),
      privateInferenceCapable: Boolean(input.privateInferenceCapable),
      evidenceLevel: input.evidenceLevel,
      notes: input.notes || [],
      updatedAt: new Date().toISOString(),
      updatedBy: context?.updatedBy || undefined,
    };

    await Promise.all([
      redis.setex(pairKey(record.id), RETENTION_SECONDS, JSON.stringify(record)),
      redis.zadd(PAIR_INDEX_KEY, {
        score: Date.parse(record.updatedAt) || Date.now(),
        member: record.id,
      }),
      redis.expire(PAIR_INDEX_KEY, RETENTION_SECONDS),
    ]);

    return record;
  }

  async getPairOverride(id: string): Promise<AlignmentPairOverrideRecord | null> {
    const raw = await redis.get(pairKey(id));
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) as AlignmentPairOverrideRecord : raw as AlignmentPairOverrideRecord;
  }

  async listPairOverrides(limit: number = 100): Promise<AlignmentPairOverrideRecord[]> {
    const pairIds = (await redis.zrange(PAIR_INDEX_KEY, 0, -1, { rev: true })).map(String).slice(0, limit);
    const records: AlignmentPairOverrideRecord[] = [];
    for (const id of pairIds) {
      const record = await this.getPairOverride(id);
      if (record) records.push(record);
    }
    return records;
  }

  async listEffectivePairs(filters?: {
    sourceProvider?: string | null;
    targetProvider?: string | null;
    taskFamily?: AlignmentTaskFamily | null;
    includeBlocked?: boolean | null;
  }): Promise<AlignmentPairRecord[]> {
    const basePairs = listAlignmentPairs({ includeBlocked: true });
    const overrides = await this.listPairOverrides(250);
    const merged = new Map<string, AlignmentPairRecord>();

    for (const pair of basePairs) {
      merged.set(pair.id, pair);
    }

    for (const override of overrides) {
      const existing = merged.get(override.id);
      merged.set(override.id, existing ? {
        ...existing,
        ...override,
        notes: override.notes?.length ? override.notes : existing.notes,
      } : {
        ...override,
      });
    }

    const sourceProvider = (filters?.sourceProvider || '').trim().toLowerCase();
    const targetProvider = (filters?.targetProvider || '').trim().toLowerCase();
    const taskFamily = filters?.taskFamily || null;
    const includeBlocked = Boolean(filters?.includeBlocked);

    return Array.from(merged.values()).filter((pair) => {
      if (!includeBlocked && pair.status === 'blocked') return false;
      if (sourceProvider && pair.sourceProvider !== sourceProvider) return false;
      if (targetProvider && pair.targetProvider !== targetProvider) return false;
      if (taskFamily && pair.taskFamily !== taskFamily) return false;
      return true;
    });
  }

  async findEffectivePair(input: {
    sourceProvider?: string | null;
    targetProvider?: string | null;
    taskFamily: AlignmentTaskFamily;
  }): Promise<AlignmentPairRecord | null> {
    const sourceProvider = (input.sourceProvider || '').trim().toLowerCase();
    const targetProvider = (input.targetProvider || '').trim().toLowerCase();

    if (!sourceProvider || !targetProvider) return null;

    const effectivePairs = await this.listEffectivePairs({
      taskFamily: input.taskFamily,
      includeBlocked: true,
    });

    return (
      effectivePairs.find((pair) =>
        pair.sourceProvider === sourceProvider &&
        pair.targetProvider === targetProvider &&
        pair.taskFamily === input.taskFamily
      ) ||
      effectivePairs.find((pair) =>
        pair.sourceProvider === targetProvider &&
        pair.targetProvider === sourceProvider &&
        pair.taskFamily === input.taskFamily
      ) ||
      null
    );
  }

  async getEffectivePairById(id: string): Promise<AlignmentPairRecord | null> {
    const pairs = await this.listEffectivePairs({ includeBlocked: true });
    return pairs.find((pair) => pair.id === id) || null;
  }

  async getSummary(): Promise<AlignmentSummary> {
    const [runs, benchmarks] = await Promise.all([
      this.listRuns(100),
      this.listBenchmarks(50),
    ]);
    const pairCatalog = await this.listEffectivePairs({ includeBlocked: true });
    const scores = runs
      .map((run) => Number(run.decision.compatibility?.compatibilityScore))
      .filter((value) => Number.isFinite(value) && value >= 0);

    return {
      totalRuns: runs.length,
      blockedRuns: runs.filter((run) => run.decision.executionMode === 'blocked').length,
      encryptedLinearRuns: runs.filter((run) => run.decision.executionMode === 'encrypted_linear').length,
      averageCompatibilityScore: Number(average(scores).toFixed(3)),
      validatedPairs: pairCatalog.filter((pair) => pair.status === 'validated').length,
      estimatedPairs: pairCatalog.filter((pair) => pair.status === 'estimated').length,
      blockedPairs: pairCatalog.filter((pair) => pair.status === 'blocked').length,
      storedBenchmarks: benchmarks.length,
      byExecutionMode: countBy(runs.map((run) => run.decision.executionMode)).map(({ key, count }) => ({ mode: key, count })),
      byVerdict: countBy(runs.map((run) => run.decision.verdict)).map(({ key, count }) => ({ verdict: key, count })),
      byTaskFamily: countBy(runs.map((run) => run.decision.taskFamily)).map(({ key, count }) => ({ taskFamily: key, count })),
      byTargetProvider: countBy(runs.map((run) => run.decision.chosenProvider || '')).map(({ key, count }) => ({ provider: key, count })),
      recentRuns: runs.slice(0, 8).map((run) => ({
        requestId: run.requestId,
        executionMode: run.decision.executionMode,
        verdict: run.decision.verdict,
        targetProvider: run.decision.chosenProvider,
        taskFamily: run.decision.taskFamily,
        compatibilityScore: Number(run.decision.compatibility?.compatibilityScore || 0),
        recordedAt: run.recordedAt,
      })),
      recentBenchmarks: benchmarks.slice(0, 8),
    };
  }
}

export const alignmentPersistenceService = new AlignmentPersistenceService();
