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
import { queryMemory, upsertMemory } from '../lib/vector.js';
import { redis } from '../lib/redis.js';
import {
  latentTrajectoryService,
  type SupportedSector,
} from './LatentTrajectoryService.js';
import { memoryFabricPolicyService } from './MemoryFabricPolicyService.js';
import { policyEngine, type PolicyResult } from './PolicyEngine.js';
import { sharedReceiptService } from './SharedReceiptService.js';

const RETENTION_SECONDS = 180 * 24 * 60 * 60;
const GOAL_INDEX_KEY = 'cortex:goals:index';
const PLAN_INDEX_KEY = 'cortex:plans:index';
const MEMORY_INDEX_KEY = 'cortex:memory:index';
const TOOL_RUN_INDEX_KEY = 'cortex:tool-runs:index';

const SUPPORTED_SECTORS = new Set<SupportedSector>([
  'finance',
  'legal',
  'healthcare',
  'robotics',
  'biotech',
  'energy',
  'general',
]);

export type CortexGoalStatus = 'active' | 'paused' | 'completed' | 'blocked';
export type CortexRisk = 'low' | 'medium' | 'high';
export type CortexPlanStatus = 'ready' | 'needs_review' | 'blocked';
export type CortexPlanStepStatus = 'ready' | 'proposed' | 'needs_review' | 'blocked' | 'completed';
export type CortexMemoryKind = 'episode' | 'belief' | 'procedure' | 'failure' | 'preference';
export type CortexToolRunStatus = 'proposed' | 'simulated' | 'blocked' | 'approved' | 'completed' | 'failed';

export type CortexGoalRecord = {
  id: string;
  objective: string;
  status: CortexGoalStatus;
  sector: SupportedSector;
  risk: CortexRisk;
  orgId?: string | null;
  actorId?: string | null;
  constraints: string[];
  successCriteria: string[];
  preferredTools: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  lastPlanId?: string | null;
};

export type CortexWorldModel = {
  sector: SupportedSector;
  confidence: number;
  driftScore: number;
  collapseRisk: number;
  expectedShift: number;
  anchorCount: number;
};

export type CortexMemoryRecord = {
  id: string;
  kind: CortexMemoryKind;
  content: string;
  confidence: number;
  importance: number;
  goalId?: string | null;
  orgId?: string | null;
  actorId?: string | null;
  tags: string[];
  evidenceRefs: string[];
  status: 'active' | 'superseded' | 'contradicted';
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CortexSemanticHit = {
  id: string;
  score: number;
  data: string;
  metadata: Record<string, unknown>;
};

export type CortexPlanStep = {
  id: string;
  stage: 'observe' | 'recall' | 'model' | 'plan' | 'act' | 'verify' | 'reflect';
  action: string;
  rationale: string;
  status: CortexPlanStepStatus;
  tool?: string | null;
  requiresApproval: boolean;
  acceptanceCriteria: string[];
};

export type CortexVerification = {
  verdict: SharedReceiptVerdict;
  status: CortexPlanStatus;
  confidence: number;
  notes: string[];
};

export type CortexPlanRecord = {
  id: string;
  goalId: string;
  objective: string;
  status: CortexPlanStatus;
  risk: CortexRisk;
  sector: SupportedSector;
  mode: 'shadow' | 'advisory' | 'execute';
  steps: CortexPlanStep[];
  memory: {
    semanticHits: CortexSemanticHit[];
    records: CortexMemoryRecord[];
  };
  worldModel: CortexWorldModel;
  verification: CortexVerification;
  receiptId: string;
  createdAt: string;
  updatedAt: string;
};

export type CortexToolRunRecord = {
  id: string;
  planId: string;
  goalId: string;
  stepId?: string | null;
  tool: string;
  input: Record<string, unknown>;
  status: CortexToolRunStatus;
  mode: 'propose' | 'simulate' | 'approved';
  requiresApproval: boolean;
  reversible: boolean;
  result?: Record<string, unknown> | null;
  blockedReason?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CortexCreateGoalInput = {
  objective: string;
  sectorHint?: string | null;
  orgId?: string | null;
  actorId?: string | null;
  constraints?: string[] | null;
  successCriteria?: string[] | null;
  preferredTools?: string[] | null;
  metadata?: Record<string, unknown> | null;
};

export type CortexCreatePlanInput = {
  goalId: string;
  prompt?: string | null;
  mode?: 'shadow' | 'advisory' | 'execute' | null;
  tools?: string[] | null;
  finalAction?: 'publish' | 'send' | 'pay' | 'delete' | 'external_store' | 'manual' | null;
  requireHumanGate?: boolean | null;
  memoryTopK?: number | null;
};

export type CortexReflectInput = {
  goalId: string;
  planId?: string | null;
  outcome: 'success' | 'partial' | 'failure' | 'blocked';
  summary: string;
  facts?: string[] | null;
  procedures?: string[] | null;
  failures?: string[] | null;
  preferences?: string[] | null;
  confidence?: number | null;
  completeGoal?: boolean | null;
};

export type CortexMemorySearchInput = {
  query?: string | null;
  goalId?: string | null;
  orgId?: string | null;
  kinds?: CortexMemoryKind[] | null;
  tags?: string[] | null;
  limit?: number | null;
  semanticTopK?: number | null;
};

export type CortexRunCycleInput = CortexCreateGoalInput & {
  prompt?: string | null;
  mode?: 'shadow' | 'advisory' | 'execute' | null;
  tools?: string[] | null;
  finalAction?: CortexCreatePlanInput['finalAction'];
  requireHumanGate?: boolean | null;
  reflection?: Omit<CortexReflectInput, 'goalId' | 'planId'> | null;
};

type CortexDeps = {
  redisClient?: typeof redis;
  policy?: typeof policyEngine;
  trajectory?: typeof latentTrajectoryService;
  queryMemoryFn?: typeof queryMemory;
  upsertMemoryFn?: typeof upsertMemory;
  receiptService?: typeof sharedReceiptService;
};

function goalKey(id: string) {
  return `cortex:goal:${id}`;
}

function planKey(id: string) {
  return `cortex:plan:${id}`;
}

function memoryKey(id: string) {
  return `cortex:memory:${id}`;
}

function toolRunKey(id: string) {
  return `cortex:tool-run:${id}`;
}

function goalPlansKey(goalId: string) {
  return `cortex:goal:${goalId}:plans`;
}

function goalMemoryKey(goalId: string) {
  return `cortex:goal:${goalId}:memory`;
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

function slugify(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || fallback;
}

function excerpt(value: string, length = 600): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact.length > length ? `${compact.slice(0, length - 3)}...` : compact;
}

function normalizeStrings(values?: string[] | null, max = 25): string[] {
  return Array.from(new Set((values || []).map((value) => safeText(value)).filter(Boolean))).slice(0, max);
}

function memoryHallForKind(kind: CortexMemoryKind): 'facts' | 'events' | 'advice' | 'preferences' {
  if (kind === 'episode') return 'events';
  if (kind === 'procedure') return 'advice';
  if (kind === 'preference') return 'preferences';
  return 'facts';
}

function buildCortexMemoryFilter(input: {
  orgId?: string | null;
  tags?: string[] | null;
}): Record<string, unknown> | undefined {
  const filter: Record<string, unknown> = {};
  const orgId = safeText(input.orgId);
  const tags = normalizeStrings(input.tags, 20);

  if (orgId) filter.namespace = orgId;
  if (orgId) filter.memoryWing = slugify(orgId, 'cortex');
  if (tags.length === 1) filter.tags = tags[0];

  return Object.keys(filter).length > 0 ? filter : undefined;
}

function decorateCortexMemoryMetadata(memory: CortexMemoryRecord): Record<string, unknown> {
  const wing = slugify(memory.orgId || 'cortex', 'cortex');
  const hall = memoryHallForKind(memory.kind);
  const room = slugify(memory.goalId || memory.kind, memory.kind);
  const layer = memory.kind === 'belief' ? 'critical_facts' : 'deep_search';

  return {
    ...memory.metadata,
    namespace: memory.orgId || 'cortex',
    goalId: memory.goalId || null,
    memoryKind: memory.kind,
    memoryWing: wing,
    memoryHall: hall,
    memoryRoom: room,
    memoryLayer: layer,
    memoryPath: `${wing}/${hall}/${room}`,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeSector(
  sectorHint: string | null | undefined,
  text: string,
  trajectory: typeof latentTrajectoryService,
): SupportedSector {
  const hinted = safeText(sectorHint).toLowerCase() as SupportedSector;
  if (SUPPORTED_SECTORS.has(hinted)) return hinted;
  const inferred = trajectory.inferSector(text);
  return SUPPORTED_SECTORS.has(inferred) ? inferred : 'general';
}

function determineRisk(input: {
  sector: SupportedSector;
  text: string;
  finalAction?: string | null;
  requireHumanGate?: boolean | null;
}): CortexRisk {
  if (input.requireHumanGate) return 'high';
  if (input.finalAction && input.finalAction !== 'manual') return 'high';
  if (['finance', 'legal', 'healthcare', 'biotech', 'energy'].includes(input.sector)) return 'high';

  const lower = input.text.toLowerCase();
  if (['delete', 'pay', 'wire', 'publish', 'send to all', 'external store', 'credential', 'secret', 'pii'].some((term) => lower.includes(term))) {
    return 'high';
  }
  if (['customer', 'contract', 'policy', 'compliance', 'production'].some((term) => lower.includes(term))) {
    return 'medium';
  }
  return 'low';
}

function normalizeWorldModel(prediction: any, sector: SupportedSector): CortexWorldModel {
  return {
    sector,
    confidence: Number(clamp(Number(prediction?.confidence ?? 0.55), 0, 1).toFixed(4)),
    driftScore: Number(clamp(Number(prediction?.driftScore ?? 0), 0, 1).toFixed(4)),
    collapseRisk: Number(clamp(Number(prediction?.collapseRisk ?? 0), 0, 1).toFixed(4)),
    expectedShift: Number(clamp(Number(prediction?.expectedShift ?? 0), 0, 1).toFixed(4)),
    anchorCount: Number(prediction?.anchorCount || 0),
  };
}

function parseRecord<T>(raw: unknown): T | null {
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) as T : raw as T;
}

function buildPlanSteps(input: {
  goal: CortexGoalRecord;
  prompt: string;
  tools: string[];
  semanticHitCount: number;
  memoryRecordCount: number;
  finalAction?: string | null;
  requireHumanGate?: boolean | null;
  verificationStatus: CortexPlanStatus;
}): CortexPlanStep[] {
  const highControl = input.goal.risk === 'high' || input.requireHumanGate || (input.finalAction && input.finalAction !== 'manual');
  const actionTools = input.tools.length > 0 ? input.tools : ['internal.synthesize'];
  const steps: CortexPlanStep[] = [
    {
      id: 'observe',
      stage: 'observe',
      action: 'Normalize the objective, prompt, constraints, and current environment signal.',
      rationale: 'A durable goal needs a stable state representation before it can plan.',
      status: 'ready',
      requiresApproval: false,
      acceptanceCriteria: ['Objective and constraints are explicit', 'Risk posture is assigned'],
    },
    {
      id: 'recall',
      stage: 'recall',
      action: 'Retrieve semantic memory, prior episodes, beliefs, failures, and reusable procedures.',
      rationale: `Recovered ${input.semanticHitCount} semantic hits and ${input.memoryRecordCount} Cortex records.`,
      status: 'ready',
      requiresApproval: false,
      acceptanceCriteria: ['Relevant memory is attached', 'Missing memory is treated as uncertainty'],
    },
    {
      id: 'model',
      stage: 'model',
      action: 'Estimate likely drift, uncertainty, and consequence shape before acting.',
      rationale: `Sector ${input.goal.sector} is running with ${input.goal.risk} risk posture.`,
      status: 'ready',
      requiresApproval: false,
      acceptanceCriteria: ['World-model confidence is recorded', 'Elevated drift forces review'],
    },
    {
      id: 'decompose',
      stage: 'plan',
      action: 'Decompose the goal into reversible actions and explicit checks.',
      rationale: 'Long-horizon agency needs typed steps that can be resumed, audited, and revised.',
      status: input.verificationStatus === 'blocked' ? 'blocked' : 'ready',
      requiresApproval: false,
      acceptanceCriteria: ['Every action has an owner or tool', 'Every action has a verification condition'],
    },
  ];

  actionTools.forEach((tool, index) => {
    steps.push({
      id: `act_${index + 1}`,
      stage: 'act',
      action: tool === 'internal.synthesize'
        ? 'Produce an advisory next move without external side effects.'
        : `Prepare a gated call to ${tool}.`,
      rationale: tool === 'internal.synthesize'
        ? 'No external tool is needed for the first pass.'
        : 'Tool calls must be proposed and checked before execution adapters are allowed to run.',
      status: input.verificationStatus === 'blocked' ? 'blocked' : highControl ? 'needs_review' : 'proposed',
      tool,
      requiresApproval: highControl || tool !== 'internal.synthesize',
      acceptanceCriteria: [
        'Verifier status is not blocked',
        highControl ? 'Human approval is recorded before side effects' : 'Inputs are bounded and reversible',
      ],
    });
  });

  steps.push(
    {
      id: 'verify',
      stage: 'verify',
      action: 'Run policy, budget, drift, reversibility, and customer-impact checks.',
      rationale: 'The verifier is the control point between intelligence and action.',
      status: input.verificationStatus === 'blocked' ? 'blocked' : 'ready',
      requiresApproval: false,
      acceptanceCriteria: ['Policy allows the action', 'Risk notes are attached to the receipt'],
    },
    {
      id: 'reflect',
      stage: 'reflect',
      action: 'Write the outcome back as episodes, beliefs, failures, and procedures.',
      rationale: 'The system only gets smarter if results alter future memory and planning.',
      status: input.verificationStatus === 'blocked' ? 'blocked' : 'ready',
      requiresApproval: false,
      acceptanceCriteria: ['Outcome is recorded', 'Reusable lessons are promoted'],
    },
  );

  return steps;
}

function verifyPlan(input: {
  goal: CortexGoalRecord;
  policy: PolicyResult;
  worldModel: CortexWorldModel;
  finalAction?: string | null;
  requireHumanGate?: boolean | null;
}): CortexVerification {
  const notes: string[] = [];
  let verdict: SharedReceiptVerdict = 'PASS';
  let confidence = 0.88;

  if (!input.policy.allowed) {
    notes.push(input.policy.reason || 'Policy engine blocked this Cortex plan.');
    verdict = 'BLOCK';
    confidence = 0.97;
  }

  if (input.goal.risk === 'high') {
    notes.push('High-risk sector, prompt, or final action requires review before autonomous execution.');
    if (verdict !== 'BLOCK') verdict = 'REVIEW';
    confidence = Math.min(confidence, 0.82);
  }

  if (input.requireHumanGate || (input.finalAction && input.finalAction !== 'manual')) {
    notes.push('Human gate required before final action.');
    if (verdict !== 'BLOCK') verdict = 'REVIEW';
    confidence = Math.min(confidence, 0.8);
  }

  if (input.worldModel.driftScore >= 0.55 || input.worldModel.collapseRisk >= 0.7) {
    notes.push('World model reports elevated drift or collapse risk.');
    if (verdict !== 'BLOCK') verdict = 'REVIEW';
    confidence = Math.min(confidence, 0.78);
  }

  if (notes.length === 0) {
    notes.push('Cortex checks passed: policy, risk, and world-model posture are within bounds.');
  }

  return {
    verdict,
    status: verdict === 'BLOCK' ? 'blocked' : verdict === 'REVIEW' ? 'needs_review' : 'ready',
    confidence: Number(clamp(confidence, 0.1, 0.99).toFixed(4)),
    notes,
  };
}

export class CortexRuntimeService {
  private redisClient: typeof redis;
  private policy: typeof policyEngine;
  private trajectory: typeof latentTrajectoryService;
  private queryMemoryFn: typeof queryMemory;
  private upsertMemoryFn: typeof upsertMemory;
  private receiptService: typeof sharedReceiptService;

  constructor(deps: CortexDeps = {}) {
    this.redisClient = deps.redisClient || redis;
    this.policy = deps.policy || policyEngine;
    this.trajectory = deps.trajectory || latentTrajectoryService;
    this.queryMemoryFn = deps.queryMemoryFn || queryMemory;
    this.upsertMemoryFn = deps.upsertMemoryFn || upsertMemory;
    this.receiptService = deps.receiptService || sharedReceiptService;
  }

  getBlueprint() {
    return {
      service: 'agentcache-cortex',
      thesis: 'Persistent cognitive runtime for goals, memory, world modeling, verification, and safe tool agency.',
      loop: ['observe', 'recall', 'model', 'plan', 'act', 'verify', 'reflect'],
      organs: {
        memory: ['episodes', 'beliefs', 'procedures', 'failures', 'preferences'],
        control: ['goals', 'plans', 'gated tool runs', 'shared receipts'],
        governance: ['policy engine', 'risk scoring', 'human gates', 'reversibility checks'],
        learning: ['reflection writeback', 'confidence updates', 'procedure promotion'],
      },
      endpoints: [
        'POST /api/cortex/goals',
        'POST /api/cortex/goals/:id/plan',
        'POST /api/cortex/plans/:id/tools',
        'POST /api/cortex/reflect',
        'POST /api/cortex/memory/search',
        'POST /api/cortex/cycles',
      ],
    };
  }

  async createGoal(
    input: CortexCreateGoalInput,
    context?: { principalId?: string | null },
  ): Promise<CortexGoalRecord> {
    const now = new Date().toISOString();
    const objective = safeText(input.objective);
    if (!objective) throw new Error('objective is required.');

    const sector = normalizeSector(input.sectorHint, objective, this.trajectory);
    const risk = determineRisk({ sector, text: objective });
    const goal: CortexGoalRecord = {
      id: `goal_${randomUUID()}`,
      objective,
      status: 'active',
      sector,
      risk,
      orgId: input.orgId || null,
      actorId: input.actorId || context?.principalId || null,
      constraints: normalizeStrings(input.constraints, 20),
      successCriteria: normalizeStrings(input.successCriteria, 20),
      preferredTools: normalizeStrings(input.preferredTools, 20),
      metadata: input.metadata || {},
      createdAt: now,
      updatedAt: now,
      lastPlanId: null,
    };

    await Promise.all([
      this.redisClient.setex(goalKey(goal.id), RETENTION_SECONDS, JSON.stringify(goal)),
      this.redisClient.zadd(GOAL_INDEX_KEY, { score: Date.parse(now), member: goal.id }),
      this.redisClient.expire(GOAL_INDEX_KEY, RETENTION_SECONDS),
    ]);

    return goal;
  }

  async getGoal(goalId: string): Promise<CortexGoalRecord | null> {
    return parseRecord<CortexGoalRecord>(await this.redisClient.get(goalKey(goalId)));
  }

  async listGoals(limit = 25): Promise<CortexGoalRecord[]> {
    const ids = (await this.redisClient.zrange(GOAL_INDEX_KEY, 0, -1, { rev: true })).map(String).slice(0, Math.max(1, Math.min(limit, 100)));
    const goals: CortexGoalRecord[] = [];
    for (const id of ids) {
      const goal = await this.getGoal(id);
      if (goal) goals.push(goal);
    }
    return goals;
  }

  async createPlan(
    input: CortexCreatePlanInput,
    context?: { apiKey?: string | null; principalId?: string | null },
  ): Promise<CortexPlanRecord> {
    const goal = await this.getGoal(input.goalId);
    if (!goal) throw new Error('Cortex goal not found.');

    const now = new Date().toISOString();
    const prompt = safeText(input.prompt || goal.objective);
    const tools = normalizeStrings(input.tools, 20);
    const risk = determineRisk({
      sector: goal.sector,
      text: `${goal.objective}\n${prompt}`,
      finalAction: input.finalAction,
      requireHumanGate: input.requireHumanGate,
    });
    const goalForPlan = risk === goal.risk ? goal : { ...goal, risk };

    const memory = await this.searchMemory({
      query: prompt,
      goalId: goal.id,
      orgId: goal.orgId,
      limit: 8,
      semanticTopK: input.memoryTopK || 5,
    });

    const prediction = await this.trajectory.predict({
      query: `${goal.objective}\n${prompt}`,
      sector: goal.sector,
      goalQuery: goal.objective,
    }).catch(() => null);
    const worldModel = normalizeWorldModel(prediction, goal.sector);

    const policyProfile = memoryFabricPolicyService.resolve({
      sector: goal.sector,
    });
    const busPolicy = await this.policy.evaluate({
      content: `${goal.objective}\n${prompt}`,
      sector: 'general',
      payload: {
        goalId: goal.id,
        cortex: true,
        risk,
        policyProfile,
        finalAction: input.finalAction || null,
      },
      originAgent: goal.actorId || context?.principalId || undefined,
    }).catch((error) => ({
      allowed: false,
      score: 0,
      reason: error?.message || 'Policy evaluation failed.',
    }));

    const verification = verifyPlan({
      goal: goalForPlan,
      policy: busPolicy,
      worldModel,
      finalAction: input.finalAction,
      requireHumanGate: input.requireHumanGate,
    });
    const steps = buildPlanSteps({
      goal: goalForPlan,
      prompt,
      tools: tools.length > 0 ? tools : goal.preferredTools,
      semanticHitCount: memory.semanticHits.length,
      memoryRecordCount: memory.records.length,
      finalAction: input.finalAction,
      requireHumanGate: input.requireHumanGate,
      verificationStatus: verification.status,
    });

    const receipt = this.buildPlanReceipt({
      goal: goalForPlan,
      planId: `plan_${randomUUID()}`,
      mode: input.mode || 'shadow',
      steps,
      worldModel,
      verification,
      prompt,
      createdAt: now,
    });

    const plan: CortexPlanRecord = {
      id: receipt.subject.id,
      goalId: goal.id,
      objective: goal.objective,
      status: verification.status,
      risk,
      sector: goal.sector,
      mode: input.mode || 'shadow',
      steps,
      memory,
      worldModel,
      verification,
      receiptId: receipt.receiptId,
      createdAt: now,
      updatedAt: now,
    };

    const updatedGoal: CortexGoalRecord = {
      ...goal,
      risk,
      lastPlanId: plan.id,
      updatedAt: now,
    };

    await Promise.all([
      this.redisClient.setex(planKey(plan.id), RETENTION_SECONDS, JSON.stringify(plan)),
      this.redisClient.zadd(PLAN_INDEX_KEY, { score: Date.parse(now), member: plan.id }),
      this.redisClient.zadd(goalPlansKey(goal.id), { score: Date.parse(now), member: plan.id }),
      this.redisClient.expire(PLAN_INDEX_KEY, RETENTION_SECONDS),
      this.redisClient.expire(goalPlansKey(goal.id), RETENTION_SECONDS),
      this.redisClient.setex(goalKey(goal.id), RETENTION_SECONDS, JSON.stringify(updatedGoal)),
      this.receiptService.ingest(receipt, {
        apiKey: context?.apiKey || undefined,
        principalId: context?.principalId || undefined,
      }).catch(() => null),
    ]);

    return plan;
  }

  async getPlan(planId: string): Promise<CortexPlanRecord | null> {
    return parseRecord<CortexPlanRecord>(await this.redisClient.get(planKey(planId)));
  }

  async proposeToolRun(input: {
    planId: string;
    stepId?: string | null;
    tool: string;
    input?: Record<string, unknown> | null;
    mode?: 'propose' | 'simulate' | 'approved' | null;
    approvalToken?: string | null;
    reversible?: boolean | null;
  }): Promise<CortexToolRunRecord> {
    const plan = await this.getPlan(input.planId);
    if (!plan) throw new Error('Cortex plan not found.');

    const now = new Date().toISOString();
    const tool = safeText(input.tool);
    if (!tool) throw new Error('tool is required.');

    const step = input.stepId
      ? plan.steps.find((candidate) => candidate.id === input.stepId)
      : plan.steps.find((candidate) => candidate.tool === tool) || null;
    const mode = input.mode || 'propose';
    const requiresApproval = plan.status !== 'ready' || plan.risk !== 'low' || !!step?.requiresApproval;
    const approved = mode === 'approved' && !!input.approvalToken;
    const blocked = plan.status === 'blocked' || (requiresApproval && mode !== 'simulate' && !approved);
    const record: CortexToolRunRecord = {
      id: `toolrun_${randomUUID()}`,
      planId: plan.id,
      goalId: plan.goalId,
      stepId: step?.id || input.stepId || null,
      tool,
      input: input.input || {},
      status: blocked ? 'blocked' : mode === 'simulate' ? 'simulated' : approved ? 'approved' : 'proposed',
      mode,
      requiresApproval,
      reversible: input.reversible !== false,
      result: mode === 'simulate'
        ? {
            predictedSuccess: plan.verification.verdict === 'PASS' ? 0.86 : 0.58,
            verifier: plan.verification.verdict,
            notes: plan.verification.notes,
          }
        : null,
      blockedReason: blocked
        ? 'Tool run requires an approved plan or explicit approval token before side effects.'
        : null,
      createdAt: now,
      updatedAt: now,
    };

    await Promise.all([
      this.redisClient.setex(toolRunKey(record.id), RETENTION_SECONDS, JSON.stringify(record)),
      this.redisClient.zadd(TOOL_RUN_INDEX_KEY, { score: Date.parse(now), member: record.id }),
      this.redisClient.expire(TOOL_RUN_INDEX_KEY, RETENTION_SECONDS),
    ]);

    return record;
  }

  async reflect(input: CortexReflectInput): Promise<{
    goal: CortexGoalRecord;
    memories: CortexMemoryRecord[];
  }> {
    const goal = await this.getGoal(input.goalId);
    if (!goal) throw new Error('Cortex goal not found.');

    const now = new Date().toISOString();
    const confidence = Number(clamp(input.confidence ?? (input.outcome === 'success' ? 0.86 : 0.62), 0.05, 0.99).toFixed(4));
    const memories: CortexMemoryRecord[] = [];
    const makeMemory = (
      kind: CortexMemoryKind,
      content: string,
      importance: number,
      tags: string[],
    ): CortexMemoryRecord => ({
      id: `cmem_${randomUUID()}`,
      kind,
      content,
      confidence,
      importance,
      goalId: goal.id,
      orgId: goal.orgId,
      actorId: goal.actorId,
      tags,
      evidenceRefs: [goal.id, input.planId || 'reflection'].filter(Boolean),
      status: 'active',
      metadata: {
        outcome: input.outcome,
        planId: input.planId || null,
      },
      createdAt: now,
      updatedAt: now,
    });

    memories.push(makeMemory('episode', input.summary, 0.75, ['reflection', input.outcome]));
    for (const fact of normalizeStrings(input.facts, 25)) {
      memories.push(makeMemory('belief', fact, 0.8, ['belief']));
    }
    for (const procedure of normalizeStrings(input.procedures, 25)) {
      memories.push(makeMemory('procedure', procedure, 0.85, ['procedure']));
    }
    for (const failure of normalizeStrings(input.failures, 25)) {
      memories.push(makeMemory('failure', failure, 0.9, ['failure']));
    }
    for (const preference of normalizeStrings(input.preferences, 25)) {
      memories.push(makeMemory('preference', preference, 0.7, ['preference']));
    }

    const newStatus: CortexGoalStatus = input.completeGoal
      ? 'completed'
      : input.outcome === 'blocked'
        ? 'blocked'
        : goal.status;
    const updatedGoal: CortexGoalRecord = {
      ...goal,
      status: newStatus,
      updatedAt: now,
    };

    await Promise.all([
      ...memories.map((memory) => this.persistMemory(memory)),
      this.redisClient.setex(goalKey(goal.id), RETENTION_SECONDS, JSON.stringify(updatedGoal)),
    ]);

    return {
      goal: updatedGoal,
      memories,
    };
  }

  async searchMemory(input: CortexMemorySearchInput): Promise<{
    semanticHits: CortexSemanticHit[];
    records: CortexMemoryRecord[];
  }> {
    const limit = Math.max(1, Math.min(Number(input.limit || 25), 100));
    const query = safeText(input.query || '');
    const semanticFilter = buildCortexMemoryFilter({
      orgId: input.orgId,
      tags: input.tags || undefined,
    });
    const semanticHits = query
      ? await this.queryMemoryFn(query, Math.max(1, Math.min(Number(input.semanticTopK || 5), 10)), semanticFilter)
        .then((hits) => hits.map((hit) => ({
          id: String(hit.id),
          score: Number(hit.score || 0),
          data: safeText(hit.data),
          metadata: (hit.metadata || {}) as Record<string, unknown>,
        })))
        .catch(() => [] as CortexSemanticHit[])
      : [];

    const ids = input.goalId
      ? (await this.redisClient.zrange(goalMemoryKey(input.goalId), 0, -1, { rev: true })).map(String)
      : (await this.redisClient.zrange(MEMORY_INDEX_KEY, 0, -1, { rev: true })).map(String);
    const kinds = new Set(input.kinds || []);
    const tags = new Set(normalizeStrings(input.tags, 20));
    const lowerQuery = query.toLowerCase();
    const records: CortexMemoryRecord[] = [];

    for (const id of ids) {
      if (records.length >= limit) break;
      const record = parseRecord<CortexMemoryRecord>(await this.redisClient.get(memoryKey(id)));
      if (!record) continue;
      if (input.goalId && record.goalId !== input.goalId) continue;
      if (input.orgId && record.orgId !== input.orgId) continue;
      if (kinds.size > 0 && !kinds.has(record.kind)) continue;
      if (tags.size > 0 && !record.tags.some((tag) => tags.has(tag))) continue;
      if (lowerQuery && !record.content.toLowerCase().includes(lowerQuery)) continue;
      records.push(record);
    }

    return { semanticHits, records };
  }

  async runCycle(
    input: CortexRunCycleInput,
    context?: { apiKey?: string | null; principalId?: string | null },
  ) {
    const goal = await this.createGoal(input, context);
    const plan = await this.createPlan({
      goalId: goal.id,
      prompt: input.prompt,
      mode: input.mode,
      tools: input.tools,
      finalAction: input.finalAction,
      requireHumanGate: input.requireHumanGate,
    }, context);
    const reflection = input.reflection
      ? await this.reflect({
          ...input.reflection,
          goalId: goal.id,
          planId: plan.id,
        })
      : null;

    return {
      goal: reflection?.goal || { ...goal, lastPlanId: plan.id },
      plan,
      reflection,
    };
  }

  private async persistMemory(memory: CortexMemoryRecord) {
    const score = Date.parse(memory.createdAt) || Date.now();
    const metadata = decorateCortexMemoryMetadata(memory);

    await Promise.all([
      this.redisClient.setex(memoryKey(memory.id), RETENTION_SECONDS, JSON.stringify(memory)),
      this.redisClient.zadd(MEMORY_INDEX_KEY, { score, member: memory.id }),
      memory.goalId ? this.redisClient.zadd(goalMemoryKey(memory.goalId), { score, member: memory.id }) : Promise.resolve(0),
      this.redisClient.expire(MEMORY_INDEX_KEY, RETENTION_SECONDS),
      memory.goalId ? this.redisClient.expire(goalMemoryKey(memory.goalId), RETENTION_SECONDS) : Promise.resolve(0),
      this.upsertMemoryFn(`cortex:${memory.id}`, memory.content, {
        ...metadata,
        cortexMemoryId: memory.id,
        kind: memory.kind,
        goalId: memory.goalId || null,
        orgId: memory.orgId || null,
        confidence: memory.confidence,
        importance: memory.importance,
        timestamp: Date.parse(memory.createdAt) || Date.now(),
      }).catch(() => null),
    ]);
  }

  private buildPlanReceipt(input: {
    goal: CortexGoalRecord;
    planId: string;
    mode: CortexPlanRecord['mode'];
    steps: CortexPlanStep[];
    worldModel: CortexWorldModel;
    verification: CortexVerification;
    prompt: string;
    createdAt: string;
  }): SharedReceiptEnvelope {
    return buildSharedReceipt({
      receiptId: `rcpt_${input.planId}`,
      issuedAt: input.createdAt,
      producer: {
        system: 'AGENTCACHE',
        id: 'agentcache.ai',
        role: 'cortex-runtime',
      },
      subject: {
        kind: 'ORCHESTRATOR_RUN',
        id: input.planId,
        route: '/api/cortex/goals/:id/plan',
      },
      operation: {
        action: 'cortex.plan',
        route: '/api/cortex/goals/:id/plan',
        method: 'POST',
        executionMode: input.mode,
        privacyMode: 'standard',
      },
      ontology: {
        sectorId: input.goal.sector,
        confidence: input.verification.confidence,
      },
      trust: {
        verdict: input.verification.verdict,
        status: input.verification.status,
        confidence: input.verification.confidence,
        driftScore: input.worldModel.driftScore,
      },
      evidence: {
        payloadHash: hashValue({
          goal: input.goal.objective,
          prompt: input.prompt,
          steps: input.steps,
          worldModel: input.worldModel,
        }),
        refs: {
          goalId: input.goal.id,
          orgId: input.goal.orgId || null,
        },
      },
      telemetry: {
        stageCount: input.steps.length,
        actionSteps: input.steps.filter((step) => step.stage === 'act').length,
        approvalSteps: input.steps.filter((step) => step.requiresApproval).length,
        risk: input.goal.risk,
      },
      refs: {
        goalId: input.goal.id,
        actorId: input.goal.actorId || null,
      },
      payload: {
        objective: excerpt(input.goal.objective, 500),
        verifierNotes: input.verification.notes,
        worldModel: input.worldModel,
      },
    });
  }
}

export const cortexRuntimeService = new CortexRuntimeService();
