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
import { ContextManager, type ContextResponse } from '../infrastructure/ContextManager.js';
import { LLMFactory, type ProviderType } from '../lib/llm/factory.js';
import type { CompletionResponse, Message } from '../lib/llm/types.js';
import { router, type RouteResult, type TaskType } from '../lib/llm/router.js';
import { redis } from '../lib/redis.js';
import { queryMemory, upsertMemory } from '../lib/vector.js';
import {
  latentTrajectoryService,
  type LatentTrajectoryPrediction,
  type SupportedSector,
} from './LatentTrajectoryService.js';
import {
  memoryFabricPolicyService,
  type MemoryFabricPolicy,
} from './MemoryFabricPolicyService.js';
import { policyEngine, type PolicyResult } from './PolicyEngine.js';
import { sharedReceiptService } from './SharedReceiptService.js';
import { structuredMemoryService, type MemoryStructureInput } from './StructuredMemoryService.js';

const RETENTION_SECONDS = 90 * 24 * 60 * 60;
const RUNTIME_INDEX_KEY = 'cognitive-runtime:runs:index';
const SUPPORTED_SECTORS = new Set<SupportedSector>([
  'finance',
  'legal',
  'healthcare',
  'robotics',
  'biotech',
  'energy',
  'general',
]);

export type CognitiveRuntimeMode = 'shadow' | 'plan' | 'answer' | 'execute';
export type CognitiveRuntimeStage =
  | 'perception'
  | 'state'
  | 'memory'
  | 'world_model'
  | 'planner'
  | 'reasoning'
  | 'tools'
  | 'verifier'
  | 'learning';

export type CognitiveRuntimeRisk = 'low' | 'medium' | 'high';

export interface CognitiveRuntimeInput {
  input: string | Record<string, unknown>;
  objective?: string | null;
  sessionId?: string | null;
  orgId?: string | null;
  actorId?: string | null;
  contextPackId?: string | null;
  mode?: CognitiveRuntimeMode | null;
  sectorHint?: string | null;
  tierId?: string | null;
  verticalSku?: string | null;
  taskType?: TaskType | null;
  tools?: string[] | null;
  events?: Array<Record<string, unknown>> | null;
  finalAction?: 'publish' | 'send' | 'pay' | 'delete' | 'external_store' | 'manual' | null;
  requireHumanGate?: boolean | null;
  executeModel?: boolean | null;
  executeTools?: boolean | null;
  provider?: ProviderType | null;
  model?: string | null;
  temperature?: number | null;
  maxTokens?: number | null;
  privacyMode?: 'standard' | 'redacted' | 'ephemeral' | null;
  memory?: {
    topK?: number | null;
    namespace?: string | null;
    structure?: MemoryStructureInput | null;
  } | null;
  learning?: {
    writeBack?: boolean | null;
  } | null;
}

export interface CognitiveRuntimePerception {
  inputType: 'text' | 'json';
  text: string;
  textHash: string;
  modalities: string[];
  events: Array<{
    type: string;
    timestamp?: string | null;
    summary: string;
  }>;
}

export interface CognitiveRuntimeState {
  objective: string;
  sector: SupportedSector;
  risk: CognitiveRuntimeRisk;
  sessionId: string;
  orgId?: string | null;
  actorId?: string | null;
  policy: MemoryFabricPolicy;
  contextSource: ContextResponse['source'];
  contextMessages: number;
  facts: string[];
}

export interface CognitiveRuntimeMemoryHit {
  id: string;
  score: number;
  data: string;
  metadata: Record<string, unknown>;
}

export interface CognitiveRuntimeWorldModel {
  sector: SupportedSector;
  mode: LatentTrajectoryPrediction['mode'];
  confidence: number;
  anchorCount: number;
  driftScore: number;
  expectedShift: number;
  collapseRisk: number;
}

export interface CognitiveRuntimePlanStep {
  id: string;
  stage: CognitiveRuntimeStage;
  action: string;
  reason: string;
  status: 'ready' | 'proposed' | 'skipped' | 'blocked';
}

export interface CognitiveRuntimeVerification {
  verdict: SharedReceiptVerdict;
  status: 'ready' | 'needs_review' | 'blocked';
  confidence: number;
  notes: string[];
}

export interface CognitiveRuntimeResult {
  runId: string;
  mode: CognitiveRuntimeMode;
  perception: CognitiveRuntimePerception;
  state: CognitiveRuntimeState;
  memory: {
    hits: CognitiveRuntimeMemoryHit[];
    context: ContextResponse;
  };
  worldModel: CognitiveRuntimeWorldModel;
  route: RouteResult;
  plan: CognitiveRuntimePlanStep[];
  reasoning?: {
    provider: string;
    model: string;
    content: string;
    usage?: CompletionResponse['usage'];
    metadata?: Record<string, unknown>;
  } | null;
  toolUse: {
    executed: boolean;
    proposedTools: string[];
    notes: string[];
  };
  verification: CognitiveRuntimeVerification;
  answer: string;
  receipt: SharedReceiptEnvelope;
  createdAt: string;
}

export interface StoredCognitiveRuntimeRun {
  runId: string;
  createdAt: string;
  mode: CognitiveRuntimeMode;
  objective: string;
  sessionId: string;
  orgId?: string | null;
  actorId?: string | null;
  sector: SupportedSector;
  verdict: SharedReceiptVerdict;
  status: CognitiveRuntimeVerification['status'];
  route: Pick<RouteResult, 'tier' | 'provider' | 'model' | 'reason'>;
  inputHash: string;
  inputExcerpt?: string | null;
  answerExcerpt?: string | null;
  receiptId: string;
  result: CognitiveRuntimeResult;
}

type RuntimeDeps = {
  contextManager?: ContextManager;
  modelRouter?: typeof router;
  policy?: typeof policyEngine;
  trajectory?: typeof latentTrajectoryService;
  receiptService?: typeof sharedReceiptService;
  redisClient?: typeof redis;
  queryMemoryFn?: typeof queryMemory;
  upsertMemoryFn?: typeof upsertMemory;
  llmFactory?: typeof LLMFactory;
};

function runtimeRunKey(runId: string): string {
  return `cognitive-runtime:run:${runId}`;
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
  try {
    return JSON.stringify(value);
  } catch {
    return String(value ?? '');
  }
}

function excerpt(value: string, length = 600): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact.length > length ? `${compact.slice(0, length - 3)}...` : compact;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeMode(mode?: CognitiveRuntimeMode | null): CognitiveRuntimeMode {
  return mode || 'shadow';
}

function normalizeTools(tools?: string[] | null): string[] {
  return Array.from(new Set((tools || []).map((tool) => String(tool).trim()).filter(Boolean))).slice(0, 20);
}

function collectModalities(input: unknown, events?: Array<Record<string, unknown>> | null): string[] {
  const modalities = new Set<string>(['text']);
  const text = safeText(input).toLowerCase();

  if (typeof input === 'object' && input !== null) {
    const keys = Object.keys(input as Record<string, unknown>).map((key) => key.toLowerCase());
    if (keys.some((key) => key.includes('image'))) modalities.add('image');
    if (keys.some((key) => key.includes('audio'))) modalities.add('audio');
    if (keys.some((key) => key.includes('video'))) modalities.add('video');
    if (keys.some((key) => key.includes('event'))) modalities.add('event');
  }

  if (/\.(png|jpg|jpeg|webp|gif)\b/.test(text)) modalities.add('image');
  if (/\.(mp3|wav|m4a|aac)\b/.test(text)) modalities.add('audio');
  if (/\.(mp4|mov|webm|m3u8)\b/.test(text)) modalities.add('video');
  if (events?.length) modalities.add('event');

  return Array.from(modalities);
}

function summarizeEvents(events?: Array<Record<string, unknown>> | null) {
  return (events || []).slice(0, 20).map((event, index) => ({
    type: safeText(event.type || event.kind || `event_${index + 1}`),
    timestamp: typeof event.timestamp === 'string' ? event.timestamp : null,
    summary: excerpt(safeText(event), 220),
  }));
}

function inferTaskType(text: string, requested?: TaskType | null): TaskType {
  if (requested) return requested;
  const lower = text.toLowerCase();

  if (lower.includes('classify') || lower.includes('label this')) return 'classification';
  if (lower.includes('extract') || lower.includes('parse')) return 'extraction';
  if (lower.includes('triage') || lower.includes('prioritize')) return 'triage';
  if (lower.includes('verify') || lower.includes('validate') || lower.includes('audit')) return 'verification';
  if (lower.includes('research') || lower.includes('find sources') || lower.includes('latest')) return 'research';
  if (lower.includes('email') || lower.includes('outreach') || lower.includes('campaign')) return 'outreach';
  if (lower.includes('code') || lower.includes('function') || lower.includes('typescript') || lower.includes('api')) return 'coding';
  if (lower.includes('architecture') || lower.includes('design a system') || lower.includes('roadmap')) return 'architecture';

  return 'general';
}

function normalizeSector(
  sectorHint: string | null | undefined,
  text: string,
  trajectory: typeof latentTrajectoryService,
): SupportedSector {
  const hinted = String(sectorHint || '').trim().toLowerCase() as SupportedSector;
  if (SUPPORTED_SECTORS.has(hinted)) return hinted;
  const inferred = trajectory.inferSector(text);
  return SUPPORTED_SECTORS.has(inferred) ? inferred : 'general';
}

function determineRisk(input: {
  sector: SupportedSector;
  finalAction?: string | null;
  requireHumanGate?: boolean | null;
  text: string;
}): CognitiveRuntimeRisk {
  if (input.requireHumanGate) return 'high';
  if (input.finalAction && input.finalAction !== 'manual') return 'high';
  if (['healthcare', 'finance', 'legal', 'energy', 'biotech'].includes(input.sector)) return 'high';

  const lower = input.text.toLowerCase();
  if (['delete', 'pay', 'wire', 'publish', 'send to all', 'external store', 'hipaa', 'ferpa', 'pii'].some((term) => lower.includes(term))) {
    return 'high';
  }

  if (lower.includes('policy') || lower.includes('contract') || lower.includes('customer')) return 'medium';
  return 'low';
}

function buildFacts(input: {
  perception: CognitiveRuntimePerception;
  objective: string;
  tools: string[];
  mode: CognitiveRuntimeMode;
  finalAction?: string | null;
}): string[] {
  return [
    `objective:${input.objective}`,
    `mode:${input.mode}`,
    `modalities:${input.perception.modalities.join(',')}`,
    input.tools.length > 0 ? `tools:${input.tools.join(',')}` : 'tools:none',
    input.finalAction ? `final_action:${input.finalAction}` : 'final_action:none',
  ];
}

function summarizeWorldModel(prediction: LatentTrajectoryPrediction): CognitiveRuntimeWorldModel {
  return {
    sector: prediction.sector,
    mode: prediction.mode,
    confidence: Number(prediction.confidence.toFixed(4)),
    anchorCount: prediction.anchorCount,
    driftScore: Number(prediction.driftScore.toFixed(4)),
    expectedShift: Number(prediction.expectedShift.toFixed(4)),
    collapseRisk: Number(prediction.collapseRisk.toFixed(4)),
  };
}

function buildPlan(input: {
  tools: string[];
  route: RouteResult;
  mode: CognitiveRuntimeMode;
  risk: CognitiveRuntimeRisk;
  finalAction?: string | null;
  memoryHits: number;
  contextMessages: number;
}): CognitiveRuntimePlanStep[] {
  const steps: CognitiveRuntimePlanStep[] = [
    {
      id: 'perceive',
      stage: 'perception',
      action: 'Normalize user/environment input into a compact runtime signal.',
      reason: 'The runtime needs one canonical signal before it can reason across memory and policy.',
      status: 'ready',
    },
    {
      id: 'state',
      stage: 'state',
      action: 'Build current state from objective, sector, session, risk, and policy posture.',
      reason: `Risk classified as ${input.risk}; route selected ${input.route.provider}/${input.route.model}.`,
      status: 'ready',
    },
    {
      id: 'recall',
      stage: 'memory',
      action: 'Retrieve session context and long-term semantic memory.',
      reason: `Found ${input.contextMessages} session messages and ${input.memoryHits} semantic memory hits.`,
      status: 'ready',
    },
    {
      id: 'predict',
      stage: 'world_model',
      action: 'Predict likely trajectory and collapse/drift risk before taking action.',
      reason: 'World-model scoring catches hidden-state surprises before tool execution.',
      status: 'ready',
    },
    {
      id: 'plan',
      stage: 'planner',
      action: 'Create a bounded action plan with explicit verification before output.',
      reason: input.tools.length > 0 ? 'Tools were requested, so they remain proposed until verification passes.' : 'No external tool execution is required for this pass.',
      status: 'ready',
    },
    {
      id: 'reason',
      stage: 'reasoning',
      action: input.mode === 'shadow' || input.mode === 'plan'
        ? 'Keep LLM reasoning in shadow mode.'
        : 'Generate an answer through the selected model route.',
      reason: input.route.reason,
      status: input.mode === 'shadow' || input.mode === 'plan' ? 'skipped' : 'proposed',
    },
    {
      id: 'tools',
      stage: 'tools',
      action: input.tools.length > 0 ? `Prepare tool calls: ${input.tools.join(', ')}.` : 'No tool calls proposed.',
      reason: 'Tool execution remains gated by verifier status and explicit executeTools=true.',
      status: input.tools.length > 0 ? 'proposed' : 'skipped',
    },
    {
      id: 'verify',
      stage: 'verifier',
      action: 'Apply policy, budget, drift, and human-gate checks before action.',
      reason: 'The verifier is the final control point before user-visible action.',
      status: 'ready',
    },
  ];

  if (input.finalAction && input.finalAction !== 'manual') {
    steps.push({
      id: 'gate',
      stage: 'verifier',
      action: `Require approval gate before ${input.finalAction}.`,
      reason: 'External or irreversible actions must be explicitly approved.',
      status: 'proposed',
    });
  }

  return steps;
}

function verifyRuntime(input: {
  injection: { valid: boolean; reason?: string };
  policy: PolicyResult;
  route: RouteResult;
  worldModel: CognitiveRuntimeWorldModel;
  state: CognitiveRuntimeState;
  finalAction?: string | null;
  requireHumanGate?: boolean | null;
}): CognitiveRuntimeVerification {
  const notes: string[] = [];
  let verdict: SharedReceiptVerdict = 'PASS';
  let confidence = 0.88;

  if (!input.injection.valid) {
    notes.push(input.injection.reason || 'Input failed injection validation.');
    verdict = 'BLOCK';
    confidence = 0.98;
  }

  if (!input.policy.allowed) {
    notes.push(input.policy.reason || 'Policy engine blocked the runtime signal.');
    verdict = 'BLOCK';
    confidence = Math.max(confidence, 0.95);
  }

  if (!input.route.budgetStatus.canProceed) {
    notes.push('Token budget circuit breaker cannot afford the selected route.');
    verdict = 'BLOCK';
    confidence = Math.max(confidence, 0.92);
  }

  if (!input.state.policy.eligible) {
    notes.push('Resolved memory fabric SKU is not eligible for the current tier.');
    if (verdict !== 'BLOCK') verdict = 'REVIEW';
    confidence = Math.min(confidence, 0.8);
  }

  if (input.state.risk === 'high') {
    notes.push('High-risk sector or final action requires review before autonomous execution.');
    if (verdict !== 'BLOCK') verdict = 'REVIEW';
    confidence = Math.min(confidence, 0.82);
  }

  if (input.requireHumanGate || (input.finalAction && input.finalAction !== 'manual')) {
    notes.push('Human gate required before final action.');
    if (verdict !== 'BLOCK') verdict = 'REVIEW';
    confidence = Math.min(confidence, 0.8);
  }

  if (input.worldModel.collapseRisk >= 0.7 || input.worldModel.driftScore >= 0.55) {
    notes.push('World model reports elevated drift or collapse risk.');
    if (verdict !== 'BLOCK') verdict = 'REVIEW';
    confidence = Math.min(confidence, 0.78);
  }

  if (notes.length === 0) {
    notes.push('Runtime checks passed: policy, budget, trajectory, and action risk are within bounds.');
  }

  return {
    verdict,
    status: verdict === 'BLOCK' ? 'blocked' : verdict === 'REVIEW' ? 'needs_review' : 'ready',
    confidence: Number(clamp(confidence, 0.1, 0.99).toFixed(4)),
    notes,
  };
}

function buildShadowAnswer(input: {
  mode: CognitiveRuntimeMode;
  verification: CognitiveRuntimeVerification;
  route: RouteResult;
  plan: CognitiveRuntimePlanStep[];
  state: CognitiveRuntimeState;
  memoryHits: number;
  toolNotes: string[];
}): string {
  if (input.verification.verdict === 'BLOCK') {
    return `Blocked by cognitive runtime verifier: ${input.verification.notes.join(' ')}`;
  }

  const readySteps = input.plan.filter((step) => step.status === 'ready').length;
  const proposedTools = input.toolNotes.length > 0 ? ` Proposed tool posture: ${input.toolNotes.join(' ')}` : '';
  const review = input.verification.verdict === 'REVIEW'
    ? ` Review required before autonomous action: ${input.verification.notes.join(' ')}`
    : ' Runtime is ready for a bounded answer or action.';

  return [
    `Cognitive runtime ${input.mode} pass complete for ${input.state.sector}.`,
    `Route: ${input.route.provider}/${input.route.model}.`,
    `Plan: ${readySteps} ready stages, ${input.memoryHits} memory hits.`,
    review,
    proposedTools,
  ].filter(Boolean).join(' ');
}

export class CognitiveRuntimeService {
  private contextManager: ContextManager;
  private modelRouter: typeof router;
  private policy: typeof policyEngine;
  private trajectory: typeof latentTrajectoryService;
  private receiptService: typeof sharedReceiptService;
  private redisClient: typeof redis;
  private queryMemoryFn: typeof queryMemory;
  private upsertMemoryFn: typeof upsertMemory;
  private llmFactory: typeof LLMFactory;

  constructor(deps: RuntimeDeps = {}) {
    this.contextManager = deps.contextManager || new ContextManager();
    this.modelRouter = deps.modelRouter || router;
    this.policy = deps.policy || policyEngine;
    this.trajectory = deps.trajectory || latentTrajectoryService;
    this.receiptService = deps.receiptService || sharedReceiptService;
    this.redisClient = deps.redisClient || redis;
    this.queryMemoryFn = deps.queryMemoryFn || queryMemory;
    this.upsertMemoryFn = deps.upsertMemoryFn || upsertMemory;
    this.llmFactory = deps.llmFactory || LLMFactory;
  }

  async run(input: CognitiveRuntimeInput, context?: { apiKey?: string | null; principalId?: string | null }): Promise<CognitiveRuntimeResult> {
    const runId = `crun_${randomUUID()}`;
    const createdAt = new Date().toISOString();
    const mode = normalizeMode(input.mode);
    const text = safeText(input.input);
    const objective = safeText(input.objective || text || 'Process runtime input');
    const sessionId = safeText(input.sessionId || `runtime:${runId}`);
    const tools = normalizeTools(input.tools);
    const perception: CognitiveRuntimePerception = {
      inputType: typeof input.input === 'string' ? 'text' : 'json',
      text,
      textHash: hashValue(input.input),
      modalities: collectModalities(input.input, input.events),
      events: summarizeEvents(input.events),
    };

    const [injection, contextResponse] = await Promise.all([
      this.contextManager.validateInput(text),
      this.contextManager.getContext(sessionId, text).catch(() => ({ messages: [], source: 'L1' as const })),
    ]);

    const sector = normalizeSector(input.sectorHint, `${objective}\n${text}`, this.trajectory);
    const policy = memoryFabricPolicyService.resolve({
      sector,
      verticalSku: input.verticalSku || undefined,
      tierId: input.tierId || undefined,
    });
    const risk = determineRisk({
      sector,
      finalAction: input.finalAction,
      requireHumanGate: input.requireHumanGate,
      text: `${objective}\n${text}`,
    });
    const state: CognitiveRuntimeState = {
      objective,
      sector,
      risk,
      sessionId,
      orgId: input.orgId || null,
      actorId: input.actorId || context?.principalId || null,
      policy,
      contextSource: contextResponse.source,
      contextMessages: contextResponse.messages.length,
      facts: buildFacts({
        perception,
        objective,
        tools,
        mode,
        finalAction: input.finalAction,
      }),
    };

    const memoryFilter = structuredMemoryService.buildFilter({
      structure: input.memory?.structure || undefined,
      namespace: input.memory?.namespace || undefined,
    });
    const memoryHits = await this.queryMemoryFn(text, Math.max(1, Math.min(Number(input.memory?.topK || 5), 10)), memoryFilter)
      .then((hits) => hits.map((hit) => ({
        id: String(hit.id),
        score: Number(hit.score || 0),
        data: safeText(hit.data),
        metadata: (hit.metadata || {}) as Record<string, unknown>,
      })))
      .catch(() => [] as CognitiveRuntimeMemoryHit[]);

    const prediction = await this.trajectory.predict({
      query: `${objective}\n${text}`,
      sector,
      goalQuery: objective,
    });
    const worldModel = summarizeWorldModel(prediction);
    const taskType = inferTaskType(`${objective}\n${text}`, input.taskType);
    const route = input.provider
      ? {
          ...this.modelRouter.routeByTaskType(taskType),
          provider: input.provider,
          model: input.model || this.modelRouter.routeByTaskType(taskType).model,
          reason: `Explicit provider override: ${input.provider}${input.model ? `/${input.model}` : ''}.`,
        }
      : this.modelRouter.routeByTaskType(taskType);

    if (input.model && !input.provider) {
      route.model = input.model;
      route.reason = `${route.reason} Explicit model override: ${input.model}.`;
    }

    const busPolicy = await this.policy.evaluate({
      content: text,
      sector: 'general',
      payload: {
        objective,
        sector,
        modalities: perception.modalities,
        risk,
      },
      originAgent: input.actorId || context?.principalId || undefined,
    }).catch((error) => ({
      allowed: false,
      score: 0,
      reason: error?.message || 'Policy evaluation failed.',
    }));

    const plan = buildPlan({
      tools,
      route,
      mode,
      risk,
      finalAction: input.finalAction,
      memoryHits: memoryHits.length,
      contextMessages: contextResponse.messages.length,
    });
    const verification = verifyRuntime({
      injection,
      policy: busPolicy,
      route,
      worldModel,
      state,
      finalAction: input.finalAction,
      requireHumanGate: input.requireHumanGate,
    });
    const toolUse = {
      executed: false,
      proposedTools: tools,
      notes: tools.length > 0
        ? [
            input.executeTools
              ? 'Tool execution requested but held until a concrete tool executor adapter is attached to this runtime.'
              : 'Tools proposed only; executeTools=true is required for a future execution pass.',
          ]
        : [],
    };

    const reasoning = await this.maybeReason({
      input,
      mode,
      state,
      perception,
      contextResponse,
      memoryHits,
      worldModel,
      route,
      plan,
      verification,
    });
    const answer = reasoning?.content || buildShadowAnswer({
      mode,
      verification,
      route,
      plan,
      state,
      memoryHits: memoryHits.length,
      toolNotes: toolUse.notes,
    });
    const receipt = this.buildReceipt({
      runId,
      createdAt,
      input,
      perception,
      state,
      memoryHits,
      worldModel,
      route,
      plan,
      reasoning,
      toolUse,
      verification,
      answer,
      mode,
    });

    const result: CognitiveRuntimeResult = {
      runId,
      mode,
      perception,
      state,
      memory: {
        hits: memoryHits,
        context: contextResponse,
      },
      worldModel,
      route,
      plan,
      reasoning,
      toolUse,
      verification,
      answer,
      receipt,
      createdAt,
    };

    await this.persistRun(result, input, context);
    return result;
  }

  async getRun(runId: string): Promise<StoredCognitiveRuntimeRun | null> {
    const raw = await this.redisClient.get(runtimeRunKey(runId));
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) as StoredCognitiveRuntimeRun : raw as StoredCognitiveRuntimeRun;
  }

  async listRecent(limit = 25): Promise<StoredCognitiveRuntimeRun[]> {
    const ids = (await this.redisClient.zrange(RUNTIME_INDEX_KEY, 0, -1, { rev: true })).map(String).slice(0, Math.max(1, Math.min(limit, 100)));
    const records: StoredCognitiveRuntimeRun[] = [];
    for (const id of ids) {
      const record = await this.getRun(id);
      if (record) records.push(record);
    }
    return records;
  }

  private async maybeReason(input: {
    input: CognitiveRuntimeInput;
    mode: CognitiveRuntimeMode;
    state: CognitiveRuntimeState;
    perception: CognitiveRuntimePerception;
    contextResponse: ContextResponse;
    memoryHits: CognitiveRuntimeMemoryHit[];
    worldModel: CognitiveRuntimeWorldModel;
    route: RouteResult;
    plan: CognitiveRuntimePlanStep[];
    verification: CognitiveRuntimeVerification;
  }): Promise<CognitiveRuntimeResult['reasoning']> {
    if (!input.input.executeModel) return null;
    if (input.mode === 'shadow' || input.mode === 'plan') return null;
    if (input.verification.verdict === 'BLOCK') return null;

    const provider = (input.input.provider || input.route.provider) as ProviderType;
    const model = input.input.model || input.route.model;
    const llm = this.llmFactory.createProvider(provider);
    const messages = this.buildReasoningMessages(input);
    const completion = await llm.chat(messages, {
      model,
      temperature: input.input.temperature ?? 0.2,
      maxTokens: input.input.maxTokens || undefined,
    });

    return {
      provider: completion.provider,
      model: completion.model,
      content: completion.content,
      usage: completion.usage,
      metadata: completion.metadata,
    };
  }

  private buildReasoningMessages(input: {
    state: CognitiveRuntimeState;
    perception: CognitiveRuntimePerception;
    contextResponse: ContextResponse;
    memoryHits: CognitiveRuntimeMemoryHit[];
    worldModel: CognitiveRuntimeWorldModel;
    route: RouteResult;
    plan: CognitiveRuntimePlanStep[];
    verification: CognitiveRuntimeVerification;
  }): Message[] {
    const memoryBlock = input.memoryHits
      .map((hit, index) => `${index + 1}. ${excerpt(hit.data, 280)}`)
      .join('\n');
    const planBlock = input.plan
      .map((step) => `- ${step.id}: ${step.action} (${step.status})`)
      .join('\n');
    const system = [
      'You are AgentCache Cognitive Runtime.',
      'Use the supplied state, memory, world model, route, plan, and verifier notes.',
      'Do not claim tools were executed unless the runtime says they were executed.',
      'If the verifier requires review, keep the answer advisory and do not authorize final action.',
      '',
      `State: ${stableStringify({
        objective: input.state.objective,
        sector: input.state.sector,
        risk: input.state.risk,
        policy: {
          evidenceMode: input.state.policy.evidenceMode,
          namespaceMode: input.state.policy.namespaceMode,
          complianceTags: input.state.policy.complianceTags,
        },
      })}`,
      `World model: ${stableStringify(input.worldModel)}`,
      `Route: ${input.route.provider}/${input.route.model}`,
      `Plan:\n${planBlock}`,
      `Verifier: ${input.verification.verdict} - ${input.verification.notes.join(' ')}`,
      memoryBlock ? `Memory:\n${memoryBlock}` : 'Memory: none',
    ].join('\n');

    return [
      { role: 'system', content: system },
      ...input.contextResponse.messages.slice(-8).map((message) => ({
        role: (message.role === 'assistant' || message.role === 'system') ? message.role : 'user',
        content: message.content,
      }) as Message),
      { role: 'user', content: input.perception.text },
    ];
  }

  private buildReceipt(input: {
    runId: string;
    createdAt: string;
    input: CognitiveRuntimeInput;
    perception: CognitiveRuntimePerception;
    state: CognitiveRuntimeState;
    memoryHits: CognitiveRuntimeMemoryHit[];
    worldModel: CognitiveRuntimeWorldModel;
    route: RouteResult;
    plan: CognitiveRuntimePlanStep[];
    reasoning?: CognitiveRuntimeResult['reasoning'];
    toolUse: CognitiveRuntimeResult['toolUse'];
    verification: CognitiveRuntimeVerification;
    answer: string;
    mode: CognitiveRuntimeMode;
  }): SharedReceiptEnvelope {
    return buildSharedReceipt({
      receiptId: `rcpt_${input.runId}`,
      issuedAt: input.createdAt,
      producer: {
        system: 'AGENTCACHE',
        id: 'agentcache.ai',
        role: 'cognitive-runtime',
      },
      subject: {
        kind: 'ORCHESTRATOR_RUN',
        id: input.runId,
        route: '/api/runtime/runs',
      },
      operation: {
        action: 'cognitive.runtime.run',
        provider: input.reasoning?.provider || input.route.provider,
        targetProvider: input.route.provider,
        targetModel: input.reasoning?.model || input.route.model,
        route: '/api/runtime/runs',
        method: 'POST',
        executionMode: input.mode,
        privacyMode: input.input.privacyMode || 'standard',
      },
      ontology: {
        sectorId: input.state.policy.sectorId || input.state.sector,
        ontologyRef: input.state.policy.ontologyRef || undefined,
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
          input: input.input.privacyMode === 'ephemeral' ? input.perception.textHash : input.perception.text,
          objective: input.state.objective,
          plan: input.plan,
          answer: input.answer,
        }),
        refs: {
          sessionId: input.state.sessionId,
          orgId: input.state.orgId || null,
          contextPackId: input.input.contextPackId || null,
        },
      },
      telemetry: {
        stageCount: input.plan.length,
        memoryHits: input.memoryHits.length,
        modalities: input.perception.modalities,
        routeTier: input.route.tier,
        budgetCanProceed: input.route.budgetStatus.canProceed,
        toolCount: input.toolUse.proposedTools.length,
      },
      refs: {
        runtimeRunId: input.runId,
        inputHash: input.perception.textHash,
        finalAction: input.input.finalAction || null,
      },
      payload: {
        objective: input.state.objective,
        risk: input.state.risk,
        worldModel: input.worldModel,
        verifierNotes: input.verification.notes,
        answerPreview: excerpt(input.answer, 500),
      },
    });
  }

  private async persistRun(
    result: CognitiveRuntimeResult,
    input: CognitiveRuntimeInput,
    context?: { apiKey?: string | null; principalId?: string | null },
  ) {
    const inputExcerpt = input.privacyMode === 'ephemeral' ? null : excerpt(result.perception.text, 500);
    const answerExcerpt = input.privacyMode === 'ephemeral' ? null : excerpt(result.answer, 500);
    const record: StoredCognitiveRuntimeRun = {
      runId: result.runId,
      createdAt: result.createdAt,
      mode: result.mode,
      objective: result.state.objective,
      sessionId: result.state.sessionId,
      orgId: result.state.orgId,
      actorId: result.state.actorId,
      sector: result.state.sector,
      verdict: result.verification.verdict,
      status: result.verification.status,
      route: {
        tier: result.route.tier,
        provider: result.route.provider,
        model: result.route.model,
        reason: result.route.reason,
      },
      inputHash: result.perception.textHash,
      inputExcerpt,
      answerExcerpt,
      receiptId: result.receipt.receiptId,
      result,
    };

    await Promise.all([
      this.redisClient.setex(runtimeRunKey(result.runId), RETENTION_SECONDS, JSON.stringify(record)),
      this.redisClient.zadd(RUNTIME_INDEX_KEY, { score: Date.parse(result.createdAt) || Date.now(), member: result.runId }),
      this.redisClient.expire(RUNTIME_INDEX_KEY, RETENTION_SECONDS),
      this.receiptService.ingest(result.receipt, {
        apiKey: context?.apiKey || undefined,
        principalId: context?.principalId || undefined,
      }).catch(() => null),
    ]);

    if (input.learning?.writeBack && result.verification.verdict !== 'BLOCK' && input.privacyMode !== 'ephemeral') {
      await this.upsertMemoryFn(`runtime:${result.runId}`, [
        `Objective: ${result.state.objective}`,
        `Input: ${inputExcerpt || result.perception.textHash}`,
        `Verdict: ${result.verification.verdict}`,
        `Answer: ${answerExcerpt || ''}`,
      ].join('\n'), {
        type: 'cognitive_runtime_run',
        runId: result.runId,
        sessionId: result.state.sessionId,
        orgId: result.state.orgId,
        actorId: result.state.actorId,
        sector: result.state.sector,
        verdict: result.verification.verdict,
        timestamp: Date.parse(result.createdAt) || Date.now(),
      }).catch(() => null);
    }
  }
}

export const cognitiveRuntimeService = new CognitiveRuntimeService();
