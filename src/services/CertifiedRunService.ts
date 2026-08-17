/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 *
 * Certified Agent Runs are the Trust Ledger product surface. They bind
 * source-bound evidence, policy decisions, and hashed tool actions into an
 * auditable record without persisting raw arguments or tool results.
 */

import {
  buildSharedReceipt,
  type SharedReceiptEnvelope,
  type SharedReceiptVerdict,
} from '../contracts/shared-receipt.js';
import { stableHash } from '../lib/stable-json.js';
import { redis } from '../lib/redis.js';
import { evidencePackService, type EvidencePackRecord } from './EvidencePackService.js';

const RETENTION_SECONDS = 90 * 24 * 60 * 60;
const INDEX_KEY = 'certified_runs:index';
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export type CertifiedRunStatus = 'pending_approval' | 'approved' | 'rejected' | 'blocked';
export type CertifiedActionRisk = 'low' | 'medium' | 'high' | 'critical';
export type CertifiedActionStatus = 'proposed' | 'executed' | 'failed' | 'skipped';

export type CertifiedActionInput = {
  id?: string;
  tool: string;
  operation: string;
  risk?: CertifiedActionRisk | string;
  status?: CertifiedActionStatus | string;
  arguments?: unknown;
  argumentsHash?: string;
  result?: unknown;
  resultHash?: string;
  metadata?: Record<string, unknown>;
};

export type CertifiedRunInput = {
  title: string;
  intent: string;
  evidencePackIds?: string[];
  actions: CertifiedActionInput[];
  namespace?: string;
  sectorId?: string;
  policy?: {
    allowedTools?: string[];
    maxRisk?: CertifiedActionRisk | string;
    requireHumanApproval?: boolean;
  };
  metadata?: Record<string, unknown>;
};

export type CertifiedActionRecord = {
  id: string;
  tool: string;
  operation: string;
  risk: CertifiedActionRisk;
  status: CertifiedActionStatus;
  argumentsHash: string;
  resultHash?: string;
  actionHash: string;
  metadata?: Record<string, unknown>;
};

export type CertifiedDecision = {
  decidedAt: string;
  decidedBy?: string;
  note?: string;
  receiptId: string;
};

export type CertifiedRunRecord = {
  id: string;
  title: string;
  intent: string;
  status: CertifiedRunStatus;
  verdict: SharedReceiptVerdict;
  namespace?: string;
  sectorId?: string;
  createdAt: string;
  ledgerHash: string;
  evidence: Array<{
    packId: string;
    packHash: string;
    verdict: SharedReceiptVerdict;
    confidence: number;
  }>;
  actions: CertifiedActionRecord[];
  policy: {
    allowedTools: string[];
    maxRisk: CertifiedActionRisk;
    requireHumanApproval: boolean;
    canonicalWrite: false;
  };
  approval: {
    required: boolean;
    decision: 'pending' | 'approved' | 'rejected' | 'not_required';
    reason: string;
    decisionRecord?: CertifiedDecision;
  };
  receipt: SharedReceiptEnvelope;
  decisionReceipt?: SharedReceiptEnvelope;
  metadata?: Record<string, unknown>;
};

const RISK_ORDER: Record<CertifiedActionRisk, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

function runKey(id: string) {
  return `certified_run:${id}`;
}

function normalizeText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required.`);
  return value.trim();
}

function normalizeEnum<T extends string>(value: unknown, allowed: T[], fallback: T, field: string): T {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase() as T;
  if (!allowed.includes(normalized)) throw new Error(`Invalid ${field}.`);
  return normalized;
}

function normalizeLimit(value?: number | null): number {
  if (!value || !Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.trunc(value)));
}

function hashValue(value: unknown, fallback: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : stableHash(value ?? fallback);
}

function riskExceeds(actual: CertifiedActionRisk, maximum: CertifiedActionRisk): boolean {
  return RISK_ORDER[actual] > RISK_ORDER[maximum];
}

function buildDecisionReceipt(
  run: CertifiedRunRecord,
  decision: 'approved' | 'rejected',
  decidedAt: string,
  decidedBy?: string,
  note?: string,
): SharedReceiptEnvelope {
  return buildSharedReceipt({
    receiptId: `receipt_${run.id}_decision_${decision}`,
    issuedAt: decidedAt,
    producer: { system: 'AGENTCACHE', id: 'agentcache.ai', role: 'trust-ledger' },
    subject: { kind: 'CERTIFIED_RUN', id: run.id, route: `/api/certified-runs/${run.id}` },
    operation: {
      action: `agent.run.${decision}`,
      provider: 'agentcache',
      route: `/api/certified-runs/${run.id}/${decision}`,
      method: 'POST',
      executionMode: 'human-gated',
      privacyMode: 'hash-only',
      statusCode: decision === 'approved' ? 200 : 409,
    },
    ontology: { sectorId: run.sectorId, confidence: run.evidence.length ? Math.min(...run.evidence.map((item) => item.confidence)) : undefined },
    economics: { sku: 'certified-run', tokenCost: run.actions.length },
    trust: { verdict: decision === 'approved' ? 'PASS' : 'BLOCK', status: decision, confidence: 1 },
    evidence: {
      payloadHash: run.ledgerHash,
      attachments: [{ kind: 'certified-run', ref: run.id, hash: run.ledgerHash }],
    },
    refs: { runId: run.id, decidedBy, note },
    payload: { decision, actionCount: run.actions.length, evidencePackIds: run.evidence.map((item) => item.packId) },
  });
}

export class CertifiedRunService {
  buildRun(input: CertifiedRunInput, createdAt = new Date().toISOString()): CertifiedRunRecord {
    const title = normalizeText(input?.title, 'Certified run title');
    const intent = normalizeText(input?.intent, 'Certified run intent');
    if (!Array.isArray(input.actions) || input.actions.length === 0) throw new Error('Certified run requires at least one action.');
    if (input.actions.length > 100) throw new Error('Certified run actions are limited to 100.');

    const maxRisk = normalizeEnum(input.policy?.maxRisk, ['low', 'medium', 'high', 'critical'], 'medium', 'policy.maxRisk');
    const allowedTools = Array.isArray(input.policy?.allowedTools)
      ? input.policy!.allowedTools!.map((tool) => String(tool).trim()).filter(Boolean)
      : [];
    const requireHumanApproval = input.policy?.requireHumanApproval ?? true;
    const actions = input.actions.map((action, index): CertifiedActionRecord => {
      const tool = normalizeText(action?.tool, `Action ${index + 1} tool`);
      const operation = normalizeText(action?.operation, `Action ${index + 1} operation`);
      const risk = normalizeEnum(action.risk, ['low', 'medium', 'high', 'critical'], 'medium', `action ${index + 1} risk`);
      const status = normalizeEnum(action.status, ['proposed', 'executed', 'failed', 'skipped'], 'proposed', `action ${index + 1} status`);
      const argumentsHash = hashValue(action.argumentsHash, action.arguments === undefined ? `${tool}:${operation}` : action.arguments);
      const resultHash = action.resultHash || (action.result === undefined ? undefined : hashValue(action.result, `${tool}:${operation}:result`));
      const actionHash = stableHash({ id: action.id || `action_${index + 1}`, tool, operation, risk, status, argumentsHash, resultHash });
      return {
        id: action.id?.trim() || `action_${index + 1}`,
        tool,
        operation,
        risk,
        status,
        argumentsHash,
        resultHash,
        actionHash,
        metadata: action.metadata,
      };
    });

    const evidence = (input.evidencePackIds || []).map((packId) => String(packId).trim()).filter(Boolean);
    const ledgerHash = stableHash({ title, intent, evidence, actions, namespace: input.namespace, sectorId: input.sectorId, policy: { allowedTools, maxRisk, requireHumanApproval } });
    const id = `cert_${ledgerHash.slice(0, 32)}`;
    const policyViolations = actions.flatMap((action) => [
      allowedTools.length > 0 && !allowedTools.includes(action.tool) ? `tool_not_allowed:${action.tool}` : null,
      riskExceeds(action.risk, maxRisk) ? `risk_exceeds_policy:${action.id}` : null,
    ].filter((value): value is string => Boolean(value)));
    const highestRisk = actions.reduce<CertifiedActionRisk>((highest, action) => RISK_ORDER[action.risk] > RISK_ORDER[highest] ? action.risk : highest, 'low');
    const reviewRequired = requireHumanApproval || highestRisk === 'high' || highestRisk === 'critical' || policyViolations.length > 0 || evidence.length === 0;
    const verdict: SharedReceiptVerdict = policyViolations.length > 0 ? 'BLOCK' : reviewRequired ? 'REVIEW' : 'PASS';
    const status: CertifiedRunStatus = verdict === 'BLOCK' ? 'blocked' : reviewRequired ? 'pending_approval' : 'approved';
    const receipt = buildSharedReceipt({
      receiptId: `receipt_${id}`,
      issuedAt: createdAt,
      producer: { system: 'AGENTCACHE', id: 'agentcache.ai', role: 'trust-ledger' },
      subject: { kind: 'CERTIFIED_RUN', id, route: '/api/certified-runs' },
      operation: { action: 'agent.run.authorize', provider: 'agentcache', route: '/api/certified-runs', method: 'POST', executionMode: reviewRequired ? 'human-gated' : 'direct', privacyMode: 'hash-only', statusCode: verdict === 'BLOCK' ? 422 : 201 },
      ontology: { sectorId: input.sectorId, confidence: evidence.length ? 0.9 : 0.5 },
      economics: { sku: 'certified-run', tokenCost: actions.length },
      trust: { verdict, status: status, confidence: evidence.length ? 0.9 : 0.5 },
      evidence: { payloadHash: ledgerHash, attachments: actions.map((action) => ({ kind: 'action', ref: action.id, hash: action.actionHash })), refs: { namespace: input.namespace, sectorId: input.sectorId } },
      refs: { ledgerHash, evidencePackIds: evidence },
      payload: { title, intent, actionCount: actions.length, policyViolations, policy: { allowedTools, maxRisk, requireHumanApproval } },
    });
    return {
      id, title, intent, status, verdict, namespace: input.namespace, sectorId: input.sectorId, createdAt, ledgerHash, evidence: [], actions,
      policy: { allowedTools, maxRisk, requireHumanApproval, canonicalWrite: false },
      approval: { required: reviewRequired, decision: verdict === 'BLOCK' ? 'rejected' : reviewRequired ? 'pending' : 'not_required', reason: policyViolations.length ? policyViolations.join(', ') : evidence.length ? 'Human approval is required before consequential action.' : 'No evidence pack was supplied.', },
      receipt, metadata: input.metadata,
    };
  }

  async createRun(input: CertifiedRunInput): Promise<{ run: CertifiedRunRecord; duplicate: boolean }> {
    const draft = this.buildRun(input);
    const evidence: EvidencePackRecord[] = [];
    for (const packId of input.evidencePackIds || []) {
      const pack = await evidencePackService.getPack(String(packId));
      if (!pack) throw new Error(`Evidence pack not found: ${packId}`);
      evidence.push(pack);
    }
    const run: CertifiedRunRecord = {
      ...draft,
      evidence: evidence.map((pack) => ({ packId: pack.id, packHash: pack.packHash, verdict: pack.verdict, confidence: pack.confidence })),
    };
    if (evidence.some((pack) => pack.verdict === 'BLOCK')) {
      run.status = 'blocked'; run.verdict = 'BLOCK'; run.approval.decision = 'rejected'; run.approval.reason = 'At least one evidence pack is blocked.';
    } else if (evidence.some((pack) => pack.verdict !== 'PASS')) {
      run.verdict = 'REVIEW'; run.status = 'pending_approval'; run.approval.required = true; run.approval.decision = 'pending'; run.approval.reason = 'One or more evidence packs require review.';
    }
    const existing = await this.getRun(run.id);
    if (existing) return { run: existing, duplicate: true };
    await Promise.all([
      redis.setex(runKey(run.id), RETENTION_SECONDS, JSON.stringify(run)),
      redis.zadd(INDEX_KEY, { score: Date.parse(run.createdAt) || Date.now(), member: run.id }),
      redis.expire(INDEX_KEY, RETENTION_SECONDS),
    ]);
    return { run, duplicate: false };
  }

  async getRun(id: string): Promise<CertifiedRunRecord | null> {
    const raw = await redis.get(runKey(id));
    return raw ? (typeof raw === 'string' ? JSON.parse(raw) as CertifiedRunRecord : raw as CertifiedRunRecord) : null;
  }

  async listRuns(limit?: number): Promise<CertifiedRunRecord[]> {
    const ids = (await redis.zrange(INDEX_KEY, 0, -1, { rev: true })).map(String).slice(0, normalizeLimit(limit));
    const runs: CertifiedRunRecord[] = [];
    for (const id of ids) { const run = await this.getRun(id); if (run) runs.push(run); }
    return runs;
  }

  async decideRun(id: string, decision: 'approved' | 'rejected', context: { decidedBy?: string; note?: string } = {}) {
    const run = await this.getRun(id);
    if (!run) throw new Error('Certified run not found.');
    if (run.status === 'blocked') throw new Error('Blocked certified runs cannot be approved.');
    if (run.approval.decision !== 'pending') throw new Error('Certified run already has a final decision.');
    const decidedAt = new Date().toISOString();
    const decisionReceipt = buildDecisionReceipt(run, decision, decidedAt, context.decidedBy, context.note);
    const updated: CertifiedRunRecord = {
      ...run,
      status: decision === 'approved' ? 'approved' : 'rejected',
      verdict: decision === 'approved' ? 'PASS' : 'BLOCK',
      approval: { ...run.approval, decision, reason: context.note || `Run ${decision} by human reviewer.`, decisionRecord: { decidedAt, decidedBy: context.decidedBy, note: context.note, receiptId: decisionReceipt.receiptId } },
      decisionReceipt,
    };
    await redis.setex(runKey(id), RETENTION_SECONDS, JSON.stringify(updated));
    return { run: updated, decisionReceipt };
  }
}

export const certifiedRunService = new CertifiedRunService();
