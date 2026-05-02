/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL:
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file,
 * via any medium, is strictly prohibited.
 */

import { createHash, randomUUID } from 'node:crypto';
import {
  buildSharedReceipt,
  type SharedReceiptEnvelope,
  type SharedReceiptVerdict,
} from '../contracts/shared-receipt.js';
import { redis } from '../lib/redis.js';
import { upsertMemory } from '../lib/vector.js';
import { sharedReceiptService } from './SharedReceiptService.js';

const RETENTION_SECONDS = 180 * 24 * 60 * 60;
const EVOLUTION_RUN_INDEX_KEY = 'cortex:evolution:runs:index';
const EVOLUTION_CANDIDATE_INDEX_KEY = 'cortex:evolution:candidates:index';
const DGM_REPOSITORY = 'https://github.com/jennyzzt/dgm';

export type CortexEvolutionRunStatus =
  | 'active'
  | 'awaiting_review'
  | 'promotable'
  | 'blocked'
  | 'archived';

export type CortexEvolutionCandidateStatus =
  | 'proposed'
  | 'evaluated'
  | 'promotable'
  | 'rejected'
  | 'blocked';

export type CortexEvolutionRisk = 'low' | 'medium' | 'high';
export type CortexBenchmarkStatus = 'passed' | 'failed' | 'skipped';

export type CortexBenchmarkCommand = {
  id: string;
  command: string;
  required: boolean;
  timeoutSeconds: number;
};

export type CortexEvolutionSafetyPolicy = {
  sandboxRequired: boolean;
  humanReviewRequired: boolean;
  secretsAllowed: boolean;
  networkAllowed: boolean;
  promotionThreshold: number;
  maxChangedFiles: number;
  maxPatchBytes: number;
  requiredChecks: string[];
  customerCriticalPaths: string[];
  forbiddenPathPatterns: string[];
};

export type CortexEvolutionBenchmarkProfile = {
  id: string;
  name: string;
  description: string;
  commands: CortexBenchmarkCommand[];
  customerCriticalRoutes: string[];
};

export type CortexEvolutionRunRecord = {
  id: string;
  objective: string;
  goalId?: string | null;
  parentCommit?: string | null;
  sourceRepository: string;
  mode: 'shadow' | 'sandbox';
  status: CortexEvolutionRunStatus;
  generation: number;
  maxGenerations: number;
  candidatesPerGeneration: number;
  benchmarkProfile: CortexEvolutionBenchmarkProfile;
  safetyPolicy: CortexEvolutionSafetyPolicy;
  archive: string[];
  latestCandidateId?: string | null;
  receiptId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CortexEvolutionCandidateRecord = {
  id: string;
  runId: string;
  generation: number;
  parentCandidateId?: string | null;
  branchName?: string | null;
  summary: string;
  patchDigest: string;
  changedFiles: string[];
  patchBytes?: number | null;
  risk: CortexEvolutionRisk;
  status: CortexEvolutionCandidateStatus;
  score: number;
  benchmarkResults: CortexBenchmarkResult[];
  verification: CortexEvolutionVerification;
  receiptId?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CortexBenchmarkResult = {
  id: string;
  command?: string | null;
  status: CortexBenchmarkStatus;
  required?: boolean | null;
  durationMs?: number | null;
  exitCode?: number | null;
  summary?: string | null;
  artifactRef?: string | null;
};

export type CortexEvolutionVerification = {
  verdict: SharedReceiptVerdict;
  status: 'safe_to_review' | 'needs_work' | 'blocked';
  confidence: number;
  notes: string[];
};

export type CreateEvolutionRunInput = {
  objective: string;
  goalId?: string | null;
  parentCommit?: string | null;
  sourceRepository?: string | null;
  mode?: 'shadow' | 'sandbox' | null;
  maxGenerations?: number | null;
  candidatesPerGeneration?: number | null;
  metadata?: Record<string, unknown> | null;
};

export type ProposeEvolutionCandidateInput = {
  runId: string;
  summary: string;
  patchDigest?: string | null;
  changedFiles: string[];
  patchBytes?: number | null;
  parentCandidateId?: string | null;
  branchName?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type RecordEvolutionEvaluationInput = {
  runId: string;
  candidateId: string;
  benchmarkResults: CortexBenchmarkResult[];
  notes?: string[] | null;
};

type CortexEvolutionDeps = {
  redisClient?: typeof redis;
  receiptService?: typeof sharedReceiptService;
  upsertMemoryFn?: typeof upsertMemory;
};

const DEFAULT_BENCHMARK_PROFILE: CortexEvolutionBenchmarkProfile = {
  id: 'agentcache-cortex-standard',
  name: 'AgentCache Cortex Standard',
  description: 'Safe baseline for DGM-style candidate patches before human PR review.',
  commands: [
    {
      id: 'cortex-unit',
      command: 'npx vitest --run tests/unit/cortex-runtime-service.test.ts',
      required: true,
      timeoutSeconds: 120,
    },
    {
      id: 'cortex-types',
      command: 'npx tsc --noEmit --pretty false --module NodeNext --moduleResolution NodeNext --target ES2022 --esModuleInterop true --skipLibCheck src/services/CortexRuntimeService.ts src/api/cortex.ts',
      required: true,
      timeoutSeconds: 120,
    },
    {
      id: 'build',
      command: 'npm run build',
      required: true,
      timeoutSeconds: 600,
    },
  ],
  customerCriticalRoutes: [
    'GET /api/cdn/stream',
    'POST /api/transcode/submit',
    'POST /api/transcribe/submit',
    'GET /api/transcode/status/:jobId',
    'POST /api/provision/jettythunder',
    'GET /api/jetty/optimal-edges',
    'POST /api/jetty/track-upload',
    'POST /api/jetty/cache-chunk',
    'POST /api/helix/infer',
    'GET /api/clawsave',
    'POST /api/claw/agent',
    'POST /api/claw/storage',
    'POST /api/claw/provision',
    'POST /api/claw/memory/*',
  ],
};

const DEFAULT_SAFETY_POLICY: CortexEvolutionSafetyPolicy = {
  sandboxRequired: true,
  humanReviewRequired: true,
  secretsAllowed: false,
  networkAllowed: false,
  promotionThreshold: 0.92,
  maxChangedFiles: 30,
  maxPatchBytes: 250_000,
  requiredChecks: DEFAULT_BENCHMARK_PROFILE.commands
    .filter((command) => command.required)
    .map((command) => command.id),
  customerCriticalPaths: [
    'src/api/cdn.ts',
    'src/api/transcode.ts',
    'src/api/transcribe.ts',
    'src/api/provision-hono.ts',
    'src/api/clawsave.ts',
    'src/api/helix.ts',
    'src/middleware/auth.ts',
    'src/middleware/customerUsageTracking.ts',
    'transcoder-service/',
    'vercel.json',
  ],
  forbiddenPathPatterns: [
    '(^|/)\\.env($|\\.)',
    '(^|/)\\.npmrc$',
    '(^|/)node_modules/',
    '(^|/)dist/',
    '(^|/)studio-dist/',
    '(^|/)\\.git/',
    '\\.pem$',
    '\\.key$',
    'private[_-]?key',
    'secret',
  ],
};

function runKey(id: string) {
  return `cortex:evolution:run:${id}`;
}

function candidateKey(id: string) {
  return `cortex:evolution:candidate:${id}`;
}

function runCandidatesKey(runId: string) {
  return `cortex:evolution:run:${runId}:candidates`;
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
}

function hashValue(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function safeText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value === null || value === undefined) return '';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function parseRecord<T>(raw: unknown): T | null {
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) as T : raw as T;
}

function normalizeStrings(values?: string[] | null, max = 50): string[] {
  return Array.from(new Set((values || []).map((value) => safeText(value)).filter(Boolean))).slice(0, max);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function pathMatches(path: string, pattern: string): boolean {
  return new RegExp(pattern, 'i').test(path);
}

function touchesCustomerCriticalPath(path: string, policy: CortexEvolutionSafetyPolicy): boolean {
  return policy.customerCriticalPaths.some((criticalPath) =>
    criticalPath.endsWith('/')
      ? path.startsWith(criticalPath)
      : path === criticalPath || path.startsWith(`${criticalPath}/`)
  );
}

function assessCandidateSafety(input: {
  changedFiles: string[];
  patchBytes?: number | null;
  policy: CortexEvolutionSafetyPolicy;
}): { risk: CortexEvolutionRisk; blocked: boolean; notes: string[] } {
  const notes: string[] = [];
  let risk: CortexEvolutionRisk = 'low';
  let blocked = false;

  if (input.changedFiles.length > input.policy.maxChangedFiles) {
    notes.push(`Changed file count ${input.changedFiles.length} exceeds limit ${input.policy.maxChangedFiles}.`);
    blocked = true;
  }

  if ((input.patchBytes || 0) > input.policy.maxPatchBytes) {
    notes.push(`Patch size ${input.patchBytes} exceeds limit ${input.policy.maxPatchBytes}.`);
    blocked = true;
  }

  for (const file of input.changedFiles) {
    if (input.policy.forbiddenPathPatterns.some((pattern) => pathMatches(file, pattern))) {
      notes.push(`Forbidden path touched: ${file}.`);
      blocked = true;
    }

    if (touchesCustomerCriticalPath(file, input.policy)) {
      risk = 'high';
      notes.push(`Customer-critical path touched: ${file}.`);
    }
  }

  if (risk === 'low' && input.changedFiles.some((file) => file.startsWith('src/api/') || file.startsWith('src/services/'))) {
    risk = 'medium';
    notes.push('Core API/service path touched; human review remains required.');
  }

  if (notes.length === 0) {
    notes.push('Candidate patch is within the sandbox safety envelope.');
  }

  return { risk, blocked, notes };
}

function normalizeBenchmarkResults(
  results: CortexBenchmarkResult[],
  profile: CortexEvolutionBenchmarkProfile,
): CortexBenchmarkResult[] {
  const profileCommands = new Map(profile.commands.map((command) => [command.id, command]));

  return results.map((result) => {
    const profileCommand = profileCommands.get(result.id);
    return {
      id: result.id,
      command: result.command || profileCommand?.command || null,
      status: result.status,
      required: result.required ?? profileCommand?.required ?? false,
      durationMs: result.durationMs ?? null,
      exitCode: result.exitCode ?? null,
      summary: result.summary || null,
      artifactRef: result.artifactRef || null,
    };
  });
}

function scoreEvaluation(input: {
  results: CortexBenchmarkResult[];
  policy: CortexEvolutionSafetyPolicy;
  safetyBlocked: boolean;
  safetyNotes: string[];
}): { score: number; verification: CortexEvolutionVerification; status: CortexEvolutionCandidateStatus } {
  const resultsById = new Map(input.results.map((result) => [result.id, result]));
  const notes = [...input.safetyNotes];
  const requiredFailures = input.policy.requiredChecks.filter((checkId) => {
    const result = resultsById.get(checkId);
    return !result || result.status !== 'passed';
  });

  const requiredPassed = input.policy.requiredChecks.length - requiredFailures.length;
  const requiredScore = input.policy.requiredChecks.length > 0
    ? requiredPassed / input.policy.requiredChecks.length
    : 1;
  const optionalResults = input.results.filter((result) => !input.policy.requiredChecks.includes(result.id));
  const optionalScore = optionalResults.length > 0
    ? optionalResults.filter((result) => result.status === 'passed').length / optionalResults.length
    : 1;
  const score = Number(clamp(requiredScore * 0.85 + optionalScore * 0.15, 0, 1).toFixed(4));

  if (input.safetyBlocked) {
    return {
      score,
      status: 'blocked',
      verification: {
        verdict: 'BLOCK',
        status: 'blocked',
        confidence: 0.97,
        notes,
      },
    };
  }

  if (requiredFailures.length > 0) {
    notes.push(`Required checks failed or missing: ${requiredFailures.join(', ')}.`);
    return {
      score,
      status: 'rejected',
      verification: {
        verdict: 'REVIEW',
        status: 'needs_work',
        confidence: 0.86,
        notes,
      },
    };
  }

  if (score >= input.policy.promotionThreshold) {
    notes.push('Candidate reached the promotion threshold and is ready for human PR review.');
    return {
      score,
      status: 'promotable',
      verification: {
        verdict: 'PASS',
        status: 'safe_to_review',
        confidence: 0.9,
        notes,
      },
    };
  }

  notes.push(`Candidate score ${score} is below threshold ${input.policy.promotionThreshold}.`);
  return {
    score,
    status: 'evaluated',
    verification: {
      verdict: 'REVIEW',
      status: 'needs_work',
      confidence: 0.78,
      notes,
    },
  };
}

export class CortexEvolutionService {
  private redisClient: typeof redis;
  private receiptService: typeof sharedReceiptService;
  private upsertMemoryFn: typeof upsertMemory;

  constructor(deps: CortexEvolutionDeps = {}) {
    this.redisClient = deps.redisClient || redis;
    this.receiptService = deps.receiptService || sharedReceiptService;
    this.upsertMemoryFn = deps.upsertMemoryFn || upsertMemory;
  }

  getBlueprint() {
    return {
      service: 'cortex-evolution-lab',
      sourceInspiration: {
        name: 'Darwin Godel Machine',
        repository: DGM_REPOSITORY,
        integrationMode: 'inspired-control-plane',
        license: 'Apache-2.0',
      },
      loop: ['select parent', 'propose patch', 'sandbox', 'benchmark', 'score', 'archive', 'human review'],
      guardrails: DEFAULT_SAFETY_POLICY,
      benchmarkProfile: DEFAULT_BENCHMARK_PROFILE,
      nonGoals: [
        'No production self-modification',
        'No automatic merge',
        'No customer-data access',
        'No unsandboxed model-generated code execution',
      ],
    };
  }

  async createRun(
    input: CreateEvolutionRunInput,
    context?: { apiKey?: string | null; principalId?: string | null },
  ): Promise<CortexEvolutionRunRecord> {
    const now = new Date().toISOString();
    const objective = safeText(input.objective);
    if (!objective) throw new Error('objective is required.');

    const runId = `evo_${randomUUID()}`;
    const receipt = this.buildRunReceipt({
      runId,
      createdAt: now,
      objective,
      verdict: 'INFO',
      action: 'cortex.evolution.run.create',
      payload: {
        sourceRepository: input.sourceRepository || DGM_REPOSITORY,
        mode: input.mode || 'shadow',
      },
    });
    const run: CortexEvolutionRunRecord = {
      id: runId,
      objective,
      goalId: input.goalId || null,
      parentCommit: input.parentCommit || null,
      sourceRepository: input.sourceRepository || DGM_REPOSITORY,
      mode: input.mode || 'shadow',
      status: 'active',
      generation: 0,
      maxGenerations: Math.max(1, Math.min(Number(input.maxGenerations || 8), 80)),
      candidatesPerGeneration: Math.max(1, Math.min(Number(input.candidatesPerGeneration || 2), 10)),
      benchmarkProfile: DEFAULT_BENCHMARK_PROFILE,
      safetyPolicy: DEFAULT_SAFETY_POLICY,
      archive: [],
      latestCandidateId: null,
      receiptId: receipt.receiptId,
      metadata: input.metadata || {},
      createdAt: now,
      updatedAt: now,
    };

    await Promise.all([
      this.redisClient.setex(runKey(run.id), RETENTION_SECONDS, JSON.stringify(run)),
      this.redisClient.zadd(EVOLUTION_RUN_INDEX_KEY, { score: Date.parse(now), member: run.id }),
      this.redisClient.expire(EVOLUTION_RUN_INDEX_KEY, RETENTION_SECONDS),
      this.receiptService.ingest(receipt, {
        apiKey: context?.apiKey || undefined,
        principalId: context?.principalId || undefined,
      }).catch(() => null),
    ]);

    return run;
  }

  async getRun(runId: string): Promise<CortexEvolutionRunRecord | null> {
    return parseRecord<CortexEvolutionRunRecord>(await this.redisClient.get(runKey(runId)));
  }

  async listRuns(limit = 25): Promise<CortexEvolutionRunRecord[]> {
    const ids = (await this.redisClient.zrange(EVOLUTION_RUN_INDEX_KEY, 0, -1, { rev: true })).map(String).slice(0, Math.max(1, Math.min(limit, 100)));
    const runs: CortexEvolutionRunRecord[] = [];
    for (const id of ids) {
      const run = await this.getRun(id);
      if (run) runs.push(run);
    }
    return runs;
  }

  async getCandidate(candidateId: string): Promise<CortexEvolutionCandidateRecord | null> {
    return parseRecord<CortexEvolutionCandidateRecord>(await this.redisClient.get(candidateKey(candidateId)));
  }

  async listRunCandidates(runId: string, limit = 25): Promise<CortexEvolutionCandidateRecord[]> {
    const ids = (await this.redisClient.zrange(runCandidatesKey(runId), 0, -1, { rev: true })).map(String).slice(0, Math.max(1, Math.min(limit, 100)));
    const candidates: CortexEvolutionCandidateRecord[] = [];
    for (const id of ids) {
      const candidate = await this.getCandidate(id);
      if (candidate) candidates.push(candidate);
    }
    return candidates;
  }

  async proposeCandidate(
    input: ProposeEvolutionCandidateInput,
    context?: { apiKey?: string | null; principalId?: string | null },
  ): Promise<CortexEvolutionCandidateRecord> {
    const run = await this.getRun(input.runId);
    if (!run) throw new Error('Cortex evolution run not found.');

    const now = new Date().toISOString();
    const changedFiles = normalizeStrings(input.changedFiles, 200);
    if (changedFiles.length === 0) throw new Error('changedFiles is required.');

    const safety = assessCandidateSafety({
      changedFiles,
      patchBytes: input.patchBytes,
      policy: run.safetyPolicy,
    });
    const candidateId = `evo_cand_${randomUUID()}`;
    const verification: CortexEvolutionVerification = {
      verdict: safety.blocked ? 'BLOCK' : 'INFO',
      status: safety.blocked ? 'blocked' : 'safe_to_review',
      confidence: safety.blocked ? 0.95 : 0.72,
      notes: safety.notes,
    };
    const candidate: CortexEvolutionCandidateRecord = {
      id: candidateId,
      runId: run.id,
      generation: run.generation,
      parentCandidateId: input.parentCandidateId || null,
      branchName: input.branchName || null,
      summary: safeText(input.summary),
      patchDigest: input.patchDigest || hashValue({
        runId: run.id,
        changedFiles,
        summary: input.summary,
        patchBytes: input.patchBytes || null,
      }),
      changedFiles,
      patchBytes: input.patchBytes || null,
      risk: safety.risk,
      status: safety.blocked ? 'blocked' : 'proposed',
      score: 0,
      benchmarkResults: [],
      verification,
      receiptId: null,
      metadata: input.metadata || {},
      createdAt: now,
      updatedAt: now,
    };

    const updatedRun: CortexEvolutionRunRecord = {
      ...run,
      status: safety.blocked ? 'blocked' : run.status,
      latestCandidateId: candidate.id,
      archive: Array.from(new Set([...run.archive, candidate.id])),
      updatedAt: now,
    };

    await Promise.all([
      this.redisClient.setex(candidateKey(candidate.id), RETENTION_SECONDS, JSON.stringify(candidate)),
      this.redisClient.zadd(EVOLUTION_CANDIDATE_INDEX_KEY, { score: Date.parse(now), member: candidate.id }),
      this.redisClient.zadd(runCandidatesKey(run.id), { score: Date.parse(now), member: candidate.id }),
      this.redisClient.expire(EVOLUTION_CANDIDATE_INDEX_KEY, RETENTION_SECONDS),
      this.redisClient.expire(runCandidatesKey(run.id), RETENTION_SECONDS),
      this.redisClient.setex(runKey(run.id), RETENTION_SECONDS, JSON.stringify(updatedRun)),
      this.upsertMemoryFn(`cortex-evolution:${candidate.id}:proposal`, [
        `Evolution objective: ${run.objective}`,
        `Candidate: ${candidate.summary}`,
        `Risk: ${candidate.risk}`,
        `Status: ${candidate.status}`,
        `Changed files: ${candidate.changedFiles.join(', ')}`,
      ].join('\n'), {
        type: 'cortex_evolution_candidate',
        runId: run.id,
        candidateId: candidate.id,
        status: candidate.status,
        risk: candidate.risk,
        timestamp: Date.parse(now),
      }).catch(() => null),
    ]);

    return candidate;
  }

  async recordEvaluation(
    input: RecordEvolutionEvaluationInput,
    context?: { apiKey?: string | null; principalId?: string | null },
  ): Promise<{ run: CortexEvolutionRunRecord; candidate: CortexEvolutionCandidateRecord; receipt: SharedReceiptEnvelope }> {
    const [run, existingCandidate] = await Promise.all([
      this.getRun(input.runId),
      this.getCandidate(input.candidateId),
    ]);
    if (!run) throw new Error('Cortex evolution run not found.');
    if (!existingCandidate || existingCandidate.runId !== run.id) throw new Error('Cortex evolution candidate not found.');

    const now = new Date().toISOString();
    const safety = assessCandidateSafety({
      changedFiles: existingCandidate.changedFiles,
      patchBytes: existingCandidate.patchBytes,
      policy: run.safetyPolicy,
    });
    const benchmarkResults = normalizeBenchmarkResults(input.benchmarkResults, run.benchmarkProfile);
    const scored = scoreEvaluation({
      results: benchmarkResults,
      policy: run.safetyPolicy,
      safetyBlocked: safety.blocked,
      safetyNotes: [...safety.notes, ...normalizeStrings(input.notes, 20)],
    });
    const receipt = this.buildRunReceipt({
      runId: existingCandidate.id,
      createdAt: now,
      objective: run.objective,
      verdict: scored.verification.verdict,
      action: 'cortex.evolution.candidate.evaluate',
      payload: {
        runId: run.id,
        candidateId: existingCandidate.id,
        score: scored.score,
        status: scored.status,
        benchmarkResults,
        verification: scored.verification,
      },
    });
    const candidate: CortexEvolutionCandidateRecord = {
      ...existingCandidate,
      status: scored.status,
      score: scored.score,
      benchmarkResults,
      verification: scored.verification,
      receiptId: receipt.receiptId,
      updatedAt: now,
    };
    const runStatus: CortexEvolutionRunStatus =
      candidate.status === 'blocked'
        ? 'blocked'
        : candidate.status === 'promotable'
          ? 'awaiting_review'
          : run.status === 'promotable'
            ? 'awaiting_review'
            : 'active';
    const updatedRun: CortexEvolutionRunRecord = {
      ...run,
      status: runStatus,
      latestCandidateId: candidate.id,
      archive: Array.from(new Set([...run.archive, candidate.id])),
      updatedAt: now,
    };

    await Promise.all([
      this.redisClient.setex(candidateKey(candidate.id), RETENTION_SECONDS, JSON.stringify(candidate)),
      this.redisClient.setex(runKey(run.id), RETENTION_SECONDS, JSON.stringify(updatedRun)),
      this.receiptService.ingest(receipt, {
        apiKey: context?.apiKey || undefined,
        principalId: context?.principalId || undefined,
      }).catch(() => null),
      this.upsertMemoryFn(`cortex-evolution:${candidate.id}:evaluation`, [
        `Evolution objective: ${run.objective}`,
        `Candidate: ${candidate.summary}`,
        `Score: ${candidate.score}`,
        `Status: ${candidate.status}`,
        `Verifier: ${candidate.verification.verdict}`,
        `Notes: ${candidate.verification.notes.join(' ')}`,
      ].join('\n'), {
        type: 'cortex_evolution_evaluation',
        runId: run.id,
        candidateId: candidate.id,
        status: candidate.status,
        score: candidate.score,
        receiptId: receipt.receiptId,
        timestamp: Date.parse(now),
      }).catch(() => null),
    ]);

    return { run: updatedRun, candidate, receipt };
  }

  private buildRunReceipt(input: {
    runId: string;
    createdAt: string;
    objective: string;
    verdict: SharedReceiptVerdict;
    action: string;
    payload: Record<string, unknown>;
  }): SharedReceiptEnvelope {
    return buildSharedReceipt({
      receiptId: `rcpt_${input.runId}`,
      issuedAt: input.createdAt,
      producer: {
        system: 'AGENTCACHE',
        id: 'agentcache.ai',
        role: 'cortex-evolution-lab',
      },
      subject: {
        kind: 'ORCHESTRATOR_RUN',
        id: input.runId,
        route: '/api/cortex/evolution',
      },
      operation: {
        action: input.action,
        provider: 'agentcache-cortex',
        route: '/api/cortex/evolution',
        method: 'POST',
        executionMode: 'sandbox',
        privacyMode: 'standard',
      },
      ontology: {
        sectorId: 'general',
        confidence: input.verdict === 'PASS' ? 0.9 : input.verdict === 'BLOCK' ? 0.95 : 0.75,
      },
      trust: {
        verdict: input.verdict,
        status: input.action,
        confidence: input.verdict === 'PASS' ? 0.9 : input.verdict === 'BLOCK' ? 0.95 : 0.75,
      },
      evidence: {
        payloadHash: hashValue(input.payload),
      },
      telemetry: {
        sourceRepository: DGM_REPOSITORY,
        sandboxRequired: DEFAULT_SAFETY_POLICY.sandboxRequired,
        humanReviewRequired: DEFAULT_SAFETY_POLICY.humanReviewRequired,
      },
      refs: {
        dgmRepository: DGM_REPOSITORY,
      },
      payload: {
        objective: input.objective,
        ...input.payload,
      },
    });
  }
}

export const cortexEvolutionService = new CortexEvolutionService();
