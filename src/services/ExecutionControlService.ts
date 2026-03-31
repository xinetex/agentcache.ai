import { createHash, randomUUID } from 'node:crypto';
import {
  buildContextPackVersionReceipt,
  buildExecutionReviewReceipt,
  buildExecutionRunReceipt,
  buildGateDecisionReceipt,
} from '../contracts/shared-receipt-builders.js';
import type { SharedReceiptEnvelope, SharedReceiptVerdict } from '../contracts/shared-receipt.js';
import { redis } from '../lib/redis.js';
import { buildSignedOntologyProvenance, type SignedOntologyProvenance } from './OntologyProvenanceService.js';
import { memoryFabricPolicyService, type MemoryFabricPolicy } from './MemoryFabricPolicyService.js';

const RETENTION_SECONDS = 90 * 24 * 60 * 60;
const CONTEXT_PACK_INDEX_KEY = 'execution:context-packs:index';
const CONTEXT_PACK_VERSION_INDEX_KEY = 'execution:context-pack-versions:index';
const RUN_INDEX_KEY = 'execution:runs:index';
const REVIEW_INDEX_KEY = 'execution:reviews:index';
const GATE_INDEX_KEY = 'execution:gates:index';

export type ContextPackStatus = 'draft' | 'active' | 'archived';
export type ExecutionRunStatus = 'in_progress' | 'awaiting_review' | 'awaiting_gate' | 'completed' | 'blocked';
export type ExecutionGateStatus = 'not_required' | 'pending' | 'approved' | 'rejected';
export type ExecutionGateType = 'publish' | 'send' | 'pay' | 'delete' | 'external_store' | 'manual';
export type ReviewerRole = 'critical' | 'compliance' | 'domain' | 'rendering' | 'adjudicator';
export type ExecutionWorkflowTemplate = 'generic' | 'policy_review' | 'regulated_release' | 'research_brief';

export interface ContextPackSourceRecord {
  id: string;
  kind: string;
  uri?: string | null;
  title?: string | null;
  checksum?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ContextPackRecord {
  id: string;
  orgId?: string | null;
  name: string;
  slug: string;
  status: ContextPackStatus;
  latestVersion: number;
  latestVersionId: string;
  createdBy?: string | null;
  createdAt: string;
}

export interface ContextPackVersionRecord {
  id: string;
  contextPackId: string;
  version: number;
  objective: string;
  methodology?: string | null;
  conventions: string[];
  tools: string[];
  outputContract: Record<string, unknown>;
  policyProfile: Record<string, unknown>;
  metadata: Record<string, unknown>;
  ontology: SignedOntologyProvenance;
  policy: MemoryFabricPolicy;
  workflowTemplate: ExecutionWorkflowTemplate;
  workflowPhases: string[];
  reviewerRoles: Array<ReviewerRole | string>;
  hash: string;
  receiptId: string;
  sources: ContextPackSourceRecord[];
  createdAt: string;
}

export interface ExecutionRunRecord {
  id: string;
  orgId?: string | null;
  contextPackId: string;
  contextPackVersionId: string;
  status: ExecutionRunStatus;
  currentPhase: string;
  phasePlan: string[];
  completedPhases: string[];
  trigger: string;
  reviewVerdict: SharedReceiptVerdict;
  gateStatus: ExecutionGateStatus;
  gateId?: string | null;
  requiredReviewerRoles: Array<ReviewerRole | string>;
  completedReviewerRoles: Array<ReviewerRole | string>;
  receiptId: string;
  createdBy?: string | null;
  createdAt: string;
  completedAt?: string | null;
  inputPayload: Record<string, unknown>;
  outputPayload: Record<string, unknown>;
  notes: string[];
}

export interface ExecutionReviewRecord {
  id: string;
  executionRunId: string;
  reviewerRole: ReviewerRole | string;
  verdict: SharedReceiptVerdict;
  summary?: string | null;
  findings: string[];
  confidence?: number | null;
  receiptId: string;
  createdAt: string;
}

export interface ExecutionGateRecord {
  id: string;
  executionRunId: string;
  gateType: ExecutionGateType | string;
  status: ExecutionGateStatus;
  reason?: string | null;
  decidedBy?: string | null;
  decisionNote?: string | null;
  receiptId?: string | null;
  createdAt: string;
  decidedAt?: string | null;
}

export interface ExecutionRunBundle {
  run: ExecutionRunRecord;
  contextPack: ContextPackRecord;
  contextPackVersion: ContextPackVersionRecord;
  reviews: ExecutionReviewRecord[];
  gate: ExecutionGateRecord | null;
}

interface CreateContextPackInput {
  name: string;
  slug?: string | null;
  objective: string;
  methodology?: string | null;
  conventions?: string[] | null;
  tools?: string[] | null;
  outputContract?: Record<string, unknown> | null;
  policyProfile?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  sources?: Array<{
    kind: string;
    uri?: string | null;
    title?: string | null;
    checksum?: string | null;
    metadata?: Record<string, unknown> | null;
  }> | null;
  sectorHint?: string | null;
  orgId?: string | null;
  tierId?: string | null;
  workflowTemplate?: ExecutionWorkflowTemplate | null;
  workflowPhases?: string[] | null;
  reviewerRoles?: Array<ReviewerRole | string> | null;
}

interface StartExecutionRunInput {
  contextPackId: string;
  contextPackVersionId?: string | null;
  inputPayload?: Record<string, unknown> | null;
  outputPayload?: Record<string, unknown> | null;
  trigger?: string | null;
  finalAction?: ExecutionGateType | null;
  requireHumanGate?: boolean | null;
}

interface RecordExecutionReviewInput {
  runId: string;
  reviewerRole: ReviewerRole | string;
  verdict: SharedReceiptVerdict;
  summary?: string | null;
  findings?: string[] | null;
  confidence?: number | null;
}

interface DecideExecutionGateInput {
  gateId: string;
  decision: 'approved' | 'rejected';
  decidedBy?: string | null;
  note?: string | null;
}

interface AdvanceExecutionPhaseInput {
  runId: string;
  phase: string;
}

function contextPackKey(id: string) {
  return `execution:context-pack:${id}`;
}

function contextPackVersionKey(id: string) {
  return `execution:context-pack-version:${id}`;
}

function executionRunKey(id: string) {
  return `execution:run:${id}`;
}

function executionReviewKey(id: string) {
  return `execution:review:${id}`;
}

function executionGateKey(id: string) {
  return `execution:gate:${id}`;
}

function packVersionCounterKey(packId: string) {
  return `execution:context-pack:${packId}:version-counter`;
}

function packVersionsSetKey(packId: string) {
  return `execution:context-pack:${packId}:versions`;
}

function runReviewsSetKey(runId: string) {
  return `execution:run:${runId}:reviews`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || `context-pack-${Date.now()}`;
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
}

function hashPayload(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function shouldRequireHumanGate(
  finalAction: ExecutionGateType | null | undefined,
  requireHumanGate: boolean | null | undefined,
  policy: MemoryFabricPolicy,
): boolean {
  if (requireHumanGate) return true;
  if (finalAction && finalAction !== 'manual') return true;
  return policy.evidenceMode === 'audit' || policy.evidenceMode === 'clinical';
}

function defaultReviewerRolesForPolicy(policy: MemoryFabricPolicy): Array<ReviewerRole | string> {
  if (policy.evidenceMode === 'clinical') {
    return ['critical', 'compliance', 'domain'];
  }
  if (policy.evidenceMode === 'audit') {
    return ['critical', 'compliance'];
  }
  return ['critical'];
}

function defaultWorkflowTemplate(policy: MemoryFabricPolicy): ExecutionWorkflowTemplate {
  if (policy.evidenceMode === 'clinical') return 'regulated_release';
  if (policy.evidenceMode === 'audit') return 'policy_review';
  return 'generic';
}

function defaultWorkflowPhases(template: ExecutionWorkflowTemplate, gateRequired: boolean): string[] {
  const base =
    template === 'research_brief'
      ? ['exploration', 'draft', 'review']
      : ['draft', 'review'];
  return gateRequired ? [...base, 'gate', 'finalize'] : [...base, 'finalize'];
}

function getVerticalSku(policyProfile?: Record<string, unknown> | null): string | undefined {
  const value = policyProfile?.verticalSku;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function aggregateVerdict(reviews: ExecutionReviewRecord[]): SharedReceiptVerdict {
  if (reviews.some((review) => review.verdict === 'BLOCK')) return 'BLOCK';
  if (reviews.some((review) => review.verdict === 'REVIEW')) return 'REVIEW';
  if (reviews.some((review) => review.verdict === 'PASS')) return 'PASS';
  return 'INFO';
}

function normalizeRoleList(roles?: Array<ReviewerRole | string> | null): string[] {
  return Array.from(new Set((roles || []).map((role) => String(role).trim()).filter(Boolean)));
}

function normalizePhaseList(phases?: string[] | null): string[] {
  return Array.from(new Set((phases || []).map((phase) => phase.trim().toLowerCase()).filter(Boolean)));
}

function determineWorkflowState(
  run: ExecutionRunRecord,
  reviews: ExecutionReviewRecord[],
): Pick<ExecutionRunRecord, 'status' | 'currentPhase' | 'completedPhases' | 'completedReviewerRoles' | 'reviewVerdict' | 'completedAt' | 'notes'> {
  const aggregatedVerdict = aggregateVerdict(reviews);
  const completedReviewerRoles = Array.from(new Set(reviews.map((review) => String(review.reviewerRole).trim()).filter(Boolean)));
  const missingReviewerRoles = run.requiredReviewerRoles.filter((role) => !completedReviewerRoles.includes(role));
  const notes = [...run.notes];

  if (aggregatedVerdict === 'BLOCK') {
    return {
      status: 'blocked',
      currentPhase: 'blocked',
      completedPhases: Array.from(new Set([...run.completedPhases, run.currentPhase])),
      completedReviewerRoles,
      reviewVerdict: aggregatedVerdict,
      completedAt: run.completedAt,
      notes,
    };
  }

  if (missingReviewerRoles.length > 0 || aggregatedVerdict === 'REVIEW') {
    return {
      status: 'awaiting_review',
      currentPhase: 'review',
      completedPhases: Array.from(new Set([...run.completedPhases, 'draft'])),
      completedReviewerRoles,
      reviewVerdict: aggregatedVerdict,
      completedAt: run.completedAt,
      notes: missingReviewerRoles.length > 0
        ? [...notes, `Waiting on reviewer roles: ${missingReviewerRoles.join(', ')}.`]
        : notes,
    };
  }

  if (run.gateStatus === 'pending') {
    return {
      status: 'awaiting_gate',
      currentPhase: 'gate',
      completedPhases: Array.from(new Set([...run.completedPhases, 'draft', 'review'])),
      completedReviewerRoles,
      reviewVerdict: aggregatedVerdict,
      completedAt: run.completedAt,
      notes,
    };
  }

  return {
    status: 'completed',
    currentPhase: 'completed',
    completedPhases: Array.from(new Set([...run.completedPhases, 'draft', 'review', 'finalize'])),
    completedReviewerRoles,
    reviewVerdict: aggregatedVerdict,
    completedAt: run.completedAt || new Date().toISOString(),
    notes,
  };
}

export class ExecutionControlService {
  async createContextPack(input: CreateContextPackInput, context?: { principalId?: string | null }) {
    const packId = `ctx_${randomUUID()}`;
    const versionId = `ctxv_${randomUUID()}`;
    const createdAt = new Date().toISOString();
    const slug = slugify(input.slug || input.name);
    const ontology = buildSignedOntologyProvenance({
      requestId: versionId,
      sku: 'execution-control-v1',
      signClass: 'PROMPT',
      sectorHint: input.sectorHint || null,
      values: [
        input.name,
        input.objective,
        input.methodology || '',
        ...(input.conventions || []),
        ...(input.tools || []),
        input.outputContract || {},
        input.policyProfile || {},
        input.sources || [],
      ],
    });
    const policy = memoryFabricPolicyService.resolve({
      sector: ontology.sectorId || input.sectorHint || undefined,
      verticalSku: getVerticalSku(input.policyProfile),
      tierId: input.tierId || undefined,
    });
    const workflowTemplate = input.workflowTemplate || defaultWorkflowTemplate(policy);
    const requestedReviewerRoles = normalizeRoleList(input.reviewerRoles);
    const reviewerRoles = requestedReviewerRoles.length > 0 ? requestedReviewerRoles : defaultReviewerRolesForPolicy(policy);
    const requestedWorkflowPhases = normalizePhaseList(input.workflowPhases);
    const workflowPhases = requestedWorkflowPhases.length > 0
      ? requestedWorkflowPhases
      : defaultWorkflowPhases(workflowTemplate, shouldRequireHumanGate('manual', false, policy));
    const sources: ContextPackSourceRecord[] = (input.sources || []).map((source) => ({
      id: `csrc_${randomUUID()}`,
      kind: source.kind,
      uri: source.uri || null,
      title: source.title || null,
      checksum: source.checksum || null,
      metadata: source.metadata || {},
    }));
    const receiptId = `rcpt_${versionId}`;
    const versionPayload = {
      objective: input.objective,
      methodology: input.methodology || null,
      conventions: input.conventions || [],
      tools: input.tools || [],
      outputContract: input.outputContract || {},
      policyProfile: input.policyProfile || {},
      workflowTemplate,
      workflowPhases,
      reviewerRoles,
      metadata: input.metadata || {},
      sources,
      ontologyRef: ontology.ontologyRef,
    };
    const pack: ContextPackRecord = {
      id: packId,
      orgId: input.orgId || null,
      name: input.name.trim(),
      slug,
      status: 'active',
      latestVersion: 1,
      latestVersionId: versionId,
      createdBy: context?.principalId || null,
      createdAt,
    };
    const version: ContextPackVersionRecord = {
      id: versionId,
      contextPackId: packId,
      version: 1,
      objective: input.objective.trim(),
      methodology: input.methodology?.trim() || null,
      conventions: (input.conventions || []).map((item) => item.trim()).filter(Boolean),
      tools: (input.tools || []).map((item) => item.trim()).filter(Boolean),
      outputContract: input.outputContract || {},
      policyProfile: input.policyProfile || {},
      metadata: input.metadata || {},
      ontology,
      policy,
      workflowTemplate,
      workflowPhases,
      reviewerRoles,
      hash: hashPayload(versionPayload),
      receiptId,
      sources,
      createdAt,
    };

    const receipt = buildContextPackVersionReceipt({
      receiptId,
      producer: {
        system: 'AGENTCACHE',
        id: 'agentcache.ai',
        role: 'execution-control',
      },
      versionId,
      contextPackId: packId,
      route: '/api/execution/context-packs',
      ontology: {
        sectorId: ontology.sectorId || undefined,
        ontologyRef: ontology.ontologyRef || undefined,
        version: ontology.version || undefined,
        signClass: ontology.signClass,
        confidence: ontology.confidence,
        matchedTerms: ontology.matchedTerms,
        bridgeTrace: ontology.bridgeTrace as Array<Record<string, unknown>>,
      },
      trust: {
        verdict: 'PASS',
        confidence: ontology.confidence,
      },
      refs: {
        contextPackId: packId,
        hash: version.hash,
      },
      payload: {
        name: pack.name,
        slug: pack.slug,
        policy,
        workflowTemplate,
        workflowPhases,
        reviewerRoles,
        sourceCount: sources.length,
      },
    });

    await Promise.all([
      redis.setex(contextPackKey(packId), RETENTION_SECONDS, JSON.stringify(pack)),
      redis.setex(contextPackVersionKey(versionId), RETENTION_SECONDS, JSON.stringify(version)),
      redis.zadd(CONTEXT_PACK_INDEX_KEY, { score: Date.parse(createdAt) || Date.now(), member: packId }),
      redis.zadd(CONTEXT_PACK_VERSION_INDEX_KEY, { score: Date.parse(createdAt) || Date.now(), member: versionId }),
      redis.set(packVersionCounterKey(packId), String(version.version)),
      redis.zadd(packVersionsSetKey(packId), { score: version.version, member: versionId }),
      redis.expire(CONTEXT_PACK_INDEX_KEY, RETENTION_SECONDS),
      redis.expire(CONTEXT_PACK_VERSION_INDEX_KEY, RETENTION_SECONDS),
      redis.expire(packVersionsSetKey(packId), RETENTION_SECONDS),
    ]);

    return { pack, version, receipt };
  }

  async addContextPackVersion(
    packId: string,
    input: Omit<CreateContextPackInput, 'name' | 'slug' | 'orgId'>,
    context?: { principalId?: string | null },
  ) {
    const pack = await this.getContextPack(packId);
    if (!pack) {
      throw new Error('Context pack not found.');
    }

    const nextVersion = Number(await redis.incr(packVersionCounterKey(packId)));
    const versionId = `ctxv_${randomUUID()}`;
    const createdAt = new Date().toISOString();
    const ontology = buildSignedOntologyProvenance({
      requestId: versionId,
      sku: 'execution-control-v1',
      signClass: 'PROMPT',
      sectorHint: input.sectorHint || null,
      values: [
        pack.name,
        input.objective,
        input.methodology || '',
        ...(input.conventions || []),
        ...(input.tools || []),
        input.outputContract || {},
        input.policyProfile || {},
        input.sources || [],
      ],
    });
    const policy = memoryFabricPolicyService.resolve({
      sector: ontology.sectorId || input.sectorHint || undefined,
      verticalSku: getVerticalSku(input.policyProfile),
      tierId: input.tierId || undefined,
    });
    const workflowTemplate = input.workflowTemplate || defaultWorkflowTemplate(policy);
    const requestedReviewerRoles = normalizeRoleList(input.reviewerRoles);
    const reviewerRoles = requestedReviewerRoles.length > 0 ? requestedReviewerRoles : defaultReviewerRolesForPolicy(policy);
    const requestedWorkflowPhases = normalizePhaseList(input.workflowPhases);
    const workflowPhases = requestedWorkflowPhases.length > 0
      ? requestedWorkflowPhases
      : defaultWorkflowPhases(workflowTemplate, shouldRequireHumanGate('manual', false, policy));
    const sources: ContextPackSourceRecord[] = (input.sources || []).map((source) => ({
      id: `csrc_${randomUUID()}`,
      kind: source.kind,
      uri: source.uri || null,
      title: source.title || null,
      checksum: source.checksum || null,
      metadata: source.metadata || {},
    }));
    const receiptId = `rcpt_${versionId}`;
    const versionPayload = {
      objective: input.objective,
      methodology: input.methodology || null,
      conventions: input.conventions || [],
      tools: input.tools || [],
      outputContract: input.outputContract || {},
      policyProfile: input.policyProfile || {},
      workflowTemplate,
      workflowPhases,
      reviewerRoles,
      metadata: input.metadata || {},
      sources,
      ontologyRef: ontology.ontologyRef,
    };
    const version: ContextPackVersionRecord = {
      id: versionId,
      contextPackId: packId,
      version: nextVersion,
      objective: input.objective.trim(),
      methodology: input.methodology?.trim() || null,
      conventions: (input.conventions || []).map((item) => item.trim()).filter(Boolean),
      tools: (input.tools || []).map((item) => item.trim()).filter(Boolean),
      outputContract: input.outputContract || {},
      policyProfile: input.policyProfile || {},
      metadata: input.metadata || {},
      ontology,
      policy,
      workflowTemplate,
      workflowPhases,
      reviewerRoles,
      hash: hashPayload(versionPayload),
      receiptId,
      sources,
      createdAt,
    };

    const updatedPack: ContextPackRecord = {
      ...pack,
      latestVersion: nextVersion,
      latestVersionId: versionId,
      createdBy: context?.principalId || pack.createdBy || null,
    };

    const receipt = buildContextPackVersionReceipt({
      receiptId,
      producer: {
        system: 'AGENTCACHE',
        id: 'agentcache.ai',
        role: 'execution-control',
      },
      versionId,
      contextPackId: packId,
      route: `/api/execution/context-packs/${packId}/versions`,
      ontology: {
        sectorId: ontology.sectorId || undefined,
        ontologyRef: ontology.ontologyRef || undefined,
        version: ontology.version || undefined,
        signClass: ontology.signClass,
        confidence: ontology.confidence,
        matchedTerms: ontology.matchedTerms,
        bridgeTrace: ontology.bridgeTrace as Array<Record<string, unknown>>,
      },
      trust: {
        verdict: 'PASS',
        confidence: ontology.confidence,
      },
      refs: {
        contextPackId: packId,
        hash: version.hash,
      },
      payload: {
        version: nextVersion,
        policy,
        workflowTemplate,
        workflowPhases,
        reviewerRoles,
        sourceCount: sources.length,
      },
    });

    await Promise.all([
      redis.setex(contextPackKey(packId), RETENTION_SECONDS, JSON.stringify(updatedPack)),
      redis.setex(contextPackVersionKey(versionId), RETENTION_SECONDS, JSON.stringify(version)),
      redis.zadd(CONTEXT_PACK_VERSION_INDEX_KEY, { score: Date.parse(createdAt) || Date.now(), member: versionId }),
      redis.zadd(packVersionsSetKey(packId), { score: nextVersion, member: versionId }),
      redis.expire(packVersionsSetKey(packId), RETENTION_SECONDS),
    ]);

    return { pack: updatedPack, version, receipt };
  }

  async getContextPack(id: string): Promise<ContextPackRecord | null> {
    const raw = await redis.get(contextPackKey(id));
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) as ContextPackRecord : raw as ContextPackRecord;
  }

  async getContextPackVersion(id: string): Promise<ContextPackVersionRecord | null> {
    const raw = await redis.get(contextPackVersionKey(id));
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) as ContextPackVersionRecord : raw as ContextPackVersionRecord;
  }

  async startRun(input: StartExecutionRunInput, context?: { principalId?: string | null; orgId?: string | null }) {
    const pack = await this.getContextPack(input.contextPackId);
    if (!pack) {
      throw new Error('Context pack not found.');
    }

    const versionId = input.contextPackVersionId || pack.latestVersionId;
    const version = await this.getContextPackVersion(versionId);
    if (!version) {
      throw new Error('Context pack version not found.');
    }

    const runId = `run_${randomUUID()}`;
    const createdAt = new Date().toISOString();
    const gateRequired = shouldRequireHumanGate(input.finalAction, input.requireHumanGate, version.policy);
    const phasePlan = normalizePhaseList(version.workflowPhases).length > 0
      ? normalizePhaseList(version.workflowPhases)
      : defaultWorkflowPhases(version.workflowTemplate, gateRequired);
    const initialPhase = phasePlan[0] || 'draft';
    const gateId = gateRequired ? `gate_${randomUUID()}` : null;
    const run: ExecutionRunRecord = {
      id: runId,
      orgId: context?.orgId || pack.orgId || null,
      contextPackId: pack.id,
      contextPackVersionId: version.id,
      status: initialPhase === 'review' ? 'awaiting_review' : 'in_progress',
      currentPhase: initialPhase,
      phasePlan,
      completedPhases: [],
      trigger: input.trigger?.trim() || 'manual',
      reviewVerdict: 'INFO',
      gateStatus: gateRequired ? 'pending' : 'not_required',
      gateId,
      requiredReviewerRoles: normalizeRoleList(version.reviewerRoles),
      completedReviewerRoles: [],
      receiptId: `rcpt_${runId}`,
      createdBy: context?.principalId || null,
      createdAt,
      completedAt: null,
      inputPayload: input.inputPayload || {},
      outputPayload: input.outputPayload || {},
      notes: gateRequired
        ? [`Human approval gate created because this workflow has elevated evidence or action risk. Workflow phases: ${phasePlan.join(' -> ')}.`]
        : [`No human approval gate required for this run. Workflow phases: ${phasePlan.join(' -> ')}.`],
    };

    const gate: ExecutionGateRecord | null = gateRequired
      ? {
          id: gateId!,
          executionRunId: runId,
          gateType: input.finalAction || 'manual',
          status: 'pending',
          reason: `Evidence mode ${version.policy.evidenceMode} requires explicit approval before finalization.`,
          decidedBy: null,
          decisionNote: null,
          receiptId: null,
          createdAt,
          decidedAt: null,
        }
      : null;

    const receipt = buildExecutionRunReceipt({
      receiptId: run.receiptId,
      producer: {
        system: 'AGENTCACHE',
        id: 'agentcache.ai',
        role: 'execution-control',
      },
      runId,
      contextPackVersionId: version.id,
      route: '/api/execution/runs',
      executionMode: gateRequired ? 'gated' : 'direct',
      ontology: {
        sectorId: version.ontology.sectorId || undefined,
        ontologyRef: version.ontology.ontologyRef || undefined,
        version: version.ontology.version || undefined,
        signClass: version.ontology.signClass,
        confidence: version.ontology.confidence,
        matchedTerms: version.ontology.matchedTerms,
        bridgeTrace: version.ontology.bridgeTrace as Array<Record<string, unknown>>,
      },
      trust: {
        verdict: gateRequired ? 'REVIEW' : 'INFO',
        confidence: version.ontology.confidence,
      },
      refs: {
        contextPackId: pack.id,
        gateId: gate?.id,
        trigger: run.trigger,
      },
      payload: {
        policy: version.policy,
        objective: version.objective,
        workflowTemplate: version.workflowTemplate,
        workflowPhases: phasePlan,
        reviewerRoles: run.requiredReviewerRoles,
        inputPayload: run.inputPayload,
        finalAction: input.finalAction || null,
      },
    });

    const writes = [
      redis.setex(executionRunKey(runId), RETENTION_SECONDS, JSON.stringify(run)),
      redis.zadd(RUN_INDEX_KEY, { score: Date.parse(createdAt) || Date.now(), member: runId }),
      redis.expire(RUN_INDEX_KEY, RETENTION_SECONDS),
    ];

    if (gate) {
      writes.push(redis.setex(executionGateKey(gate.id), RETENTION_SECONDS, JSON.stringify(gate)));
      writes.push(redis.zadd(GATE_INDEX_KEY, { score: Date.parse(createdAt) || Date.now(), member: gate.id }));
      writes.push(redis.expire(GATE_INDEX_KEY, RETENTION_SECONDS));
    }

    await Promise.all(writes);

    return { run, gate, pack, version, receipt };
  }

  async recordReview(input: RecordExecutionReviewInput) {
    const run = await this.getRun(input.runId);
    if (!run) {
      throw new Error('Execution run not found.');
    }
    const version = await this.getContextPackVersion(run.contextPackVersionId);
    if (!version) {
      throw new Error('Context pack version not found.');
    }

    const reviewId = `review_${randomUUID()}`;
    const createdAt = new Date().toISOString();
    const review: ExecutionReviewRecord = {
      id: reviewId,
      executionRunId: run.id,
      reviewerRole: input.reviewerRole,
      verdict: input.verdict,
      summary: input.summary || null,
      findings: input.findings || [],
      confidence: input.confidence ?? null,
      receiptId: `rcpt_${reviewId}`,
      createdAt,
    };

    await Promise.all([
      redis.setex(executionReviewKey(review.id), RETENTION_SECONDS, JSON.stringify(review)),
      redis.zadd(REVIEW_INDEX_KEY, { score: Date.parse(createdAt) || Date.now(), member: review.id }),
      redis.zadd(runReviewsSetKey(run.id), { score: Date.parse(createdAt) || Date.now(), member: review.id }),
      redis.expire(REVIEW_INDEX_KEY, RETENTION_SECONDS),
      redis.expire(runReviewsSetKey(run.id), RETENTION_SECONDS),
    ]);

    const reviews = await this.listReviews(run.id);
    const workflowState = determineWorkflowState(run, reviews);
    const updatedRun: ExecutionRunRecord = {
      ...run,
      reviewVerdict: workflowState.reviewVerdict,
      status: workflowState.status,
      currentPhase: workflowState.currentPhase,
      completedPhases: workflowState.completedPhases,
      completedReviewerRoles: workflowState.completedReviewerRoles,
      completedAt: workflowState.completedAt,
      notes: [
        ...workflowState.notes,
        `${input.reviewerRole} review recorded with verdict ${input.verdict}.`,
      ],
    };

    await redis.setex(executionRunKey(run.id), RETENTION_SECONDS, JSON.stringify(updatedRun));

    const receipt = buildExecutionReviewReceipt({
      receiptId: review.receiptId,
      producer: {
        system: 'AGENTCACHE',
        id: 'agentcache.ai',
        role: 'execution-review-mesh',
      },
      reviewId,
      runId: run.id,
      reviewerRole: input.reviewerRole,
      route: `/api/execution/runs/${run.id}/reviews`,
      ontology: {
        sectorId: version.ontology.sectorId || undefined,
        ontologyRef: version.ontology.ontologyRef || undefined,
        version: version.ontology.version || undefined,
        signClass: version.ontology.signClass,
        confidence: version.ontology.confidence,
        matchedTerms: version.ontology.matchedTerms,
        bridgeTrace: version.ontology.bridgeTrace as Array<Record<string, unknown>>,
      },
      trust: {
        verdict: input.verdict,
        confidence: input.confidence ?? version.ontology.confidence,
      },
      refs: {
        executionRunId: run.id,
      },
      payload: {
        summary: input.summary || null,
        findings: input.findings || [],
        aggregatedVerdict: workflowState.reviewVerdict,
        requiredReviewerRoles: run.requiredReviewerRoles,
        completedReviewerRoles: workflowState.completedReviewerRoles,
      },
    });

    return { review, run: updatedRun, receipt };
  }

  async decideGate(input: DecideExecutionGateInput) {
    const gate = await this.getGate(input.gateId);
    if (!gate) {
      throw new Error('Execution gate not found.');
    }
    const run = await this.getRun(gate.executionRunId);
    if (!run) {
      throw new Error('Execution run not found.');
    }
    const version = await this.getContextPackVersion(run.contextPackVersionId);
    if (!version) {
      throw new Error('Context pack version not found.');
    }

    const decidedAt = new Date().toISOString();
    const updatedGate: ExecutionGateRecord = {
      ...gate,
      status: input.decision,
      decidedBy: input.decidedBy || null,
      decisionNote: input.note || null,
      decidedAt,
      receiptId: `rcpt_${gate.id}_${input.decision}`,
    };
    const updatedRun: ExecutionRunRecord = {
      ...run,
      gateStatus: input.decision,
      status: input.decision === 'approved' && run.reviewVerdict !== 'BLOCK' ? 'completed' : 'blocked',
      currentPhase: input.decision === 'approved' && run.reviewVerdict !== 'BLOCK' ? 'completed' : 'blocked',
      completedPhases: input.decision === 'approved' && run.reviewVerdict !== 'BLOCK'
        ? Array.from(new Set([...run.completedPhases, 'gate', 'finalize']))
        : run.completedPhases,
      completedAt: input.decision === 'approved' && run.reviewVerdict !== 'BLOCK' ? decidedAt : run.completedAt,
      notes: [
        ...run.notes,
        `Gate ${gate.id} ${input.decision} by ${input.decidedBy || 'operator'}.`,
      ],
    };

    await Promise.all([
      redis.setex(executionGateKey(gate.id), RETENTION_SECONDS, JSON.stringify(updatedGate)),
      redis.setex(executionRunKey(run.id), RETENTION_SECONDS, JSON.stringify(updatedRun)),
    ]);

    const receipt = buildGateDecisionReceipt({
      receiptId: updatedGate.receiptId!,
      producer: {
        system: 'AGENTCACHE',
        id: 'agentcache.ai',
        role: 'execution-gatekeeper',
      },
      gateId: updatedGate.id,
      runId: updatedRun.id,
      gateType: updatedGate.gateType,
      route: `/api/execution/gates/${updatedGate.id}/${input.decision === 'approved' ? 'approve' : 'reject'}`,
      ontology: {
        sectorId: version.ontology.sectorId || undefined,
        ontologyRef: version.ontology.ontologyRef || undefined,
        version: version.ontology.version || undefined,
        signClass: version.ontology.signClass,
        confidence: version.ontology.confidence,
        matchedTerms: version.ontology.matchedTerms,
        bridgeTrace: version.ontology.bridgeTrace as Array<Record<string, unknown>>,
      },
      trust: {
        verdict: input.decision === 'approved' ? 'PASS' : 'BLOCK',
        confidence: version.ontology.confidence,
      },
      refs: {
        executionRunId: updatedRun.id,
        decidedBy: input.decidedBy || null,
      },
      payload: {
        decisionNote: input.note || null,
        reviewVerdict: run.reviewVerdict,
      },
    });

    return { gate: updatedGate, run: updatedRun, receipt };
  }

  async advancePhase(input: AdvanceExecutionPhaseInput) {
    const run = await this.getRun(input.runId);
    if (!run) {
      throw new Error('Execution run not found.');
    }

    const normalizedTarget = input.phase.trim().toLowerCase();
    const phaseIndex = run.phasePlan.indexOf(normalizedTarget);
    if (phaseIndex === -1) {
      throw new Error('Requested phase is not part of this workflow.');
    }

    const currentIndex = run.phasePlan.indexOf(run.currentPhase);
    if (phaseIndex > currentIndex + 1) {
      throw new Error('Cannot skip ahead to a non-adjacent phase.');
    }

    if (normalizedTarget === 'review' && run.currentPhase !== 'review') {
      const updatedRun: ExecutionRunRecord = {
        ...run,
        status: 'awaiting_review',
        currentPhase: 'review',
        completedPhases: Array.from(new Set([...run.completedPhases, run.currentPhase])),
        notes: [...run.notes, `Advanced workflow to review phase.`],
      };
      await redis.setex(executionRunKey(run.id), RETENTION_SECONDS, JSON.stringify(updatedRun));
      return updatedRun;
    }

    if (normalizedTarget === 'gate' && run.gateStatus !== 'pending') {
      throw new Error('This run does not have a pending human gate.');
    }

    const updatedRun: ExecutionRunRecord = {
      ...run,
      status: normalizedTarget === 'review'
        ? 'awaiting_review'
        : normalizedTarget === 'gate'
          ? 'awaiting_gate'
          : 'in_progress',
      currentPhase: normalizedTarget,
      completedPhases: Array.from(new Set([...run.completedPhases, run.currentPhase])),
      notes: [...run.notes, `Advanced workflow to ${normalizedTarget} phase.`],
    };

    await redis.setex(executionRunKey(run.id), RETENTION_SECONDS, JSON.stringify(updatedRun));
    return updatedRun;
  }

  async getRun(id: string): Promise<ExecutionRunRecord | null> {
    const raw = await redis.get(executionRunKey(id));
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) as ExecutionRunRecord : raw as ExecutionRunRecord;
  }

  async getGate(id: string): Promise<ExecutionGateRecord | null> {
    const raw = await redis.get(executionGateKey(id));
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) as ExecutionGateRecord : raw as ExecutionGateRecord;
  }

  async getReview(id: string): Promise<ExecutionReviewRecord | null> {
    const raw = await redis.get(executionReviewKey(id));
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) as ExecutionReviewRecord : raw as ExecutionReviewRecord;
  }

  async listReviews(runId: string): Promise<ExecutionReviewRecord[]> {
    const ids = (await redis.zrange(runReviewsSetKey(runId), 0, -1, { rev: false })).map(String);
    const reviews: ExecutionReviewRecord[] = [];
    for (const id of ids) {
      const review = await this.getReview(id);
      if (review) reviews.push(review);
    }
    return reviews;
  }

  async getRunBundle(id: string): Promise<ExecutionRunBundle | null> {
    const run = await this.getRun(id);
    if (!run) return null;
    const [contextPack, contextPackVersion, reviews, gate] = await Promise.all([
      this.getContextPack(run.contextPackId),
      this.getContextPackVersion(run.contextPackVersionId),
      this.listReviews(run.id),
      run.gateId ? this.getGate(run.gateId) : Promise.resolve(null),
    ]);

    if (!contextPack || !contextPackVersion) return null;

    return {
      run,
      contextPack,
      contextPackVersion,
      reviews,
      gate,
    };
  }

  async listRuns(limit: number = 25): Promise<ExecutionRunRecord[]> {
    const ids = (await redis.zrange(RUN_INDEX_KEY, 0, -1, { rev: true })).map(String).slice(0, limit);
    const runs: ExecutionRunRecord[] = [];
    for (const id of ids) {
      const run = await this.getRun(id);
      if (run) runs.push(run);
    }
    return runs;
  }

  async listContextPacks(limit: number = 25): Promise<ContextPackRecord[]> {
    const ids = (await redis.zrange(CONTEXT_PACK_INDEX_KEY, 0, -1, { rev: true })).map(String).slice(0, limit);
    const packs: ContextPackRecord[] = [];
    for (const id of ids) {
      const pack = await this.getContextPack(id);
      if (pack) packs.push(pack);
    }
    return packs;
  }
}

export const executionControlService = new ExecutionControlService();
