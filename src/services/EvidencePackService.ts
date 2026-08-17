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
import {
  buildSharedReceipt,
  type SharedReceiptEnvelope,
  type SharedReceiptVerdict,
} from '../contracts/shared-receipt.js';
import { redis } from '../lib/redis.js';
import { stableHash } from '../lib/stable-json.js';

export type EvidenceClaimStatus =
  | 'SUPPORTED'
  | 'UNVERIFIED'
  | 'NEEDS_HUMAN'
  | 'CONTRADICTED'
  | 'REVIEW_READY';

export type EvidenceClaimInput = {
  id?: string;
  text: string;
  sourceRef?: string;
  quote?: string;
  spans?: Array<{ start: number; end: number }>;
  confidence?: number;
  status?: EvidenceClaimStatus | string;
};

export type EvidenceSourceInput = {
  locator?: string;
  snapshotId?: string;
  content?: string;
  contentHash?: string;
  mimeType?: string;
  retrievedAt?: string;
};

export type EvidencePackInput = {
  title: string;
  source: EvidenceSourceInput;
  claims: EvidenceClaimInput[];
  candidateId?: string;
  namespace?: string;
  sectorId?: string;
  ontologyRef?: string;
  producer?: {
    id?: string;
    role?: string;
  };
  reviewerHint?: string;
  metadata?: Record<string, unknown>;
};

export type EvidencePackSource = {
  locator?: string;
  snapshotId?: string;
  contentHash: string;
  mimeType?: string;
  retrievedAt?: string;
  bytes?: number;
};

export type EvidencePackClaim = {
  id: string;
  text: string;
  claimHash: string;
  status: EvidenceClaimStatus;
  confidence: number;
  sourceRef?: string;
  quote?: string;
  spans: Array<{ start: number; end: number }>;
  needsReview: boolean;
  reviewReasons: string[];
};

export type EvidencePackReview = {
  required: boolean;
  reason: string;
  action: 'ready_for_context_pack' | 'human_review' | 'reject_or_rework';
};

export type EvidencePackRecord = {
  id: string;
  title: string;
  packHash: string;
  createdAt: string;
  candidateId?: string;
  namespace?: string;
  sectorId?: string;
  ontologyRef?: string;
  source: EvidencePackSource;
  claims: EvidencePackClaim[];
  verdict: SharedReceiptVerdict;
  confidence: number;
  review: EvidencePackReview;
  policy: {
    liveFetch: false;
    canonicalWrite: false;
    sourceBound: boolean;
    humanPromotionRequired: true;
  };
  metadata?: Record<string, unknown>;
  receipt: SharedReceiptEnvelope;
};

export type EvidencePackListFilters = {
  verdict?: string | null;
  sectorId?: string | null;
  namespace?: string | null;
  limit?: number | null;
};

const PACK_RETENTION_SECONDS = 90 * 24 * 60 * 60;
const DEFAULT_LIST_LIMIT = 25;
const MAX_LIST_LIMIT = 100;
const MAX_CLAIMS = 100;
const PACK_INDEX_KEY = 'evidence_packs:index';
const SUPPORTED_MIN_CONFIDENCE = 0.75;

function evidencePackKey(packId: string): string {
  return `evidence_pack:${packId}`;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeLimit(limit?: number | null): number {
  if (!limit || !Number.isFinite(limit)) return DEFAULT_LIST_LIMIT;
  return Math.max(1, Math.min(MAX_LIST_LIMIT, Math.trunc(limit)));
}

function asTrimmed(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function compactObject<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null),
  ) as T;
}

function normalizeConfidence(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function normalizeStatus(value: unknown): EvidenceClaimStatus {
  const normalized = asTrimmed(value)?.toUpperCase().replace(/[\s-]+/g, '_');
  if (
    normalized === 'SUPPORTED' ||
    normalized === 'UNVERIFIED' ||
    normalized === 'NEEDS_HUMAN' ||
    normalized === 'CONTRADICTED' ||
    normalized === 'REVIEW_READY'
  ) {
    return normalized;
  }
  return 'UNVERIFIED';
}

function normalizeSpans(spans: unknown): Array<{ start: number; end: number }> {
  if (!Array.isArray(spans)) return [];
  return spans
    .map((span) => {
      if (!span || typeof span !== 'object') return null;
      const start = Number((span as any).start);
      const end = Number((span as any).end);
      if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
      const normalizedStart = Math.max(0, Math.trunc(start));
      const normalizedEnd = Math.max(normalizedStart, Math.trunc(end));
      return { start: normalizedStart, end: normalizedEnd };
    })
    .filter((span): span is { start: number; end: number } => span !== null);
}

function sourceHasLocator(source: EvidencePackSource): boolean {
  return Boolean(source.locator || source.snapshotId);
}

function normalizeSource(input: EvidenceSourceInput): EvidencePackSource {
  if (!input || typeof input !== 'object') {
    throw new Error('Evidence pack source is required.');
  }

  const locator = asTrimmed(input.locator);
  const snapshotId = asTrimmed(input.snapshotId);
  const suppliedHash = asTrimmed(input.contentHash);
  const content = typeof input.content === 'string' ? input.content : undefined;
  const contentHash = suppliedHash || (content !== undefined ? sha256(content) : undefined);

  if (!locator && !snapshotId && !contentHash) {
    throw new Error('Evidence pack source requires locator, snapshotId, contentHash, or content.');
  }

  return compactObject({
    locator,
    snapshotId,
    contentHash: contentHash || stableHash({ locator, snapshotId }),
    mimeType: asTrimmed(input.mimeType),
    retrievedAt: asTrimmed(input.retrievedAt),
    bytes: content !== undefined ? Buffer.byteLength(content, 'utf8') : undefined,
  });
}

function normalizeClaims(inputClaims: EvidenceClaimInput[], source: EvidencePackSource): EvidencePackClaim[] {
  if (!Array.isArray(inputClaims) || inputClaims.length === 0) {
    throw new Error('Evidence pack requires at least one claim.');
  }
  if (inputClaims.length > MAX_CLAIMS) {
    throw new Error(`Evidence pack claims are limited to ${MAX_CLAIMS}.`);
  }

  return inputClaims.map((claim, index) => {
    const text = asTrimmed(claim?.text);
    if (!text) {
      throw new Error(`Evidence pack claim ${index + 1} requires text.`);
    }

    const status = normalizeStatus(claim.status);
    const confidence = roundScore(normalizeConfidence(claim.confidence));
    const spans = normalizeSpans(claim.spans);
    const sourceRef = asTrimmed(claim.sourceRef);
    const quote = asTrimmed(claim.quote);
    const reviewReasons: string[] = [];

    if (status !== 'SUPPORTED') reviewReasons.push(`status:${status.toLowerCase()}`);
    if (confidence < SUPPORTED_MIN_CONFIDENCE) reviewReasons.push('low_confidence');
    if (!sourceRef && !quote && spans.length === 0) reviewReasons.push('missing_claim_anchor');
    if (!sourceHasLocator(source)) reviewReasons.push('source_not_locator_bound');

    const claimHash = stableHash({
      text,
      sourceRef,
      quote,
      spans,
      status,
      confidence,
      sourceHash: source.contentHash,
    });

    return compactObject({
      id: asTrimmed(claim.id) || `claim_${index + 1}`,
      text,
      claimHash,
      status,
      confidence,
      sourceRef,
      quote,
      spans,
      needsReview: reviewReasons.length > 0,
      reviewReasons,
    });
  });
}

function scorePack(claims: EvidencePackClaim[], source: EvidencePackSource): {
  verdict: SharedReceiptVerdict;
  confidence: number;
  review: EvidencePackReview;
} {
  const confidence = roundScore(
    claims.reduce((sum, claim) => sum + claim.confidence, 0) / claims.length,
  );
  const contradicted = claims.some((claim) => claim.status === 'CONTRADICTED');
  const needsReview = claims.some((claim) => claim.needsReview);

  if (contradicted) {
    return {
      verdict: 'BLOCK',
      confidence,
      review: {
        required: true,
        reason: 'At least one claim is marked contradicted.',
        action: 'reject_or_rework',
      },
    };
  }

  if (needsReview || !sourceHasLocator(source)) {
    return {
      verdict: 'REVIEW',
      confidence,
      review: {
        required: true,
        reason: 'One or more claims need stronger source anchoring or human review.',
        action: 'human_review',
      },
    };
  }

  return {
    verdict: 'PASS',
    confidence,
    review: {
      required: true,
      reason: 'Claims are source-bound and ready for human-controlled promotion.',
      action: 'ready_for_context_pack',
    },
  };
}

function matchesFilters(pack: EvidencePackRecord, filters: EvidencePackListFilters): boolean {
  if (filters.verdict && pack.verdict !== filters.verdict) return false;
  if (filters.sectorId && pack.sectorId !== filters.sectorId) return false;
  if (filters.namespace && pack.namespace !== filters.namespace) return false;
  return true;
}

export class EvidencePackService {
  buildPack(input: EvidencePackInput, issuedAt = new Date().toISOString()): EvidencePackRecord {
    const title = asTrimmed(input?.title);
    if (!title) {
      throw new Error('Evidence pack title is required.');
    }

    const source = normalizeSource(input.source);
    const claims = normalizeClaims(input.claims, source);
    const packHash = stableHash({
      title,
      source,
      claims: claims.map((claim) => ({
        id: claim.id,
        claimHash: claim.claimHash,
        status: claim.status,
        confidence: claim.confidence,
      })),
      candidateId: asTrimmed(input.candidateId),
      namespace: asTrimmed(input.namespace),
      sectorId: asTrimmed(input.sectorId),
      ontologyRef: asTrimmed(input.ontologyRef),
      metadata: input.metadata || {},
    });
    const id = `evpack_${packHash.slice(0, 24)}`;
    const { verdict, confidence, review } = scorePack(claims, source);
    const claimsNeedingReview = claims.filter((claim) => claim.needsReview).length;
    const policy = {
      liveFetch: false,
      canonicalWrite: false,
      sourceBound: sourceHasLocator(source),
      humanPromotionRequired: true,
    } as const;
    const receipt = buildSharedReceipt({
      receiptId: `receipt_${id}`,
      issuedAt,
      producer: {
        system: 'AGENTCACHE',
        id: asTrimmed(input.producer?.id) || 'agentcache.ai',
        role: asTrimmed(input.producer?.role) || 'evidence-pack-service',
      },
      subject: {
        kind: 'EVIDENCE_PACK',
        id,
        route: '/api/evidence/packs',
      },
      operation: {
        action: 'evidence.pack.create',
        provider: 'agentcache',
        route: '/api/evidence/packs',
        method: 'POST',
        privacyMode: 'source-hash-only',
        statusCode: verdict === 'BLOCK' ? 422 : 201,
      },
      ontology: {
        sectorId: asTrimmed(input.sectorId),
        ontologyRef: asTrimmed(input.ontologyRef),
        confidence,
      },
      economics: {
        sku: 'evidence-claim',
        tokenCost: claims.length,
      },
      trust: {
        verdict,
        status: review.action,
        confidence,
      },
      evidence: {
        payloadHash: packHash,
        attachments: [
          {
            kind: 'source-snapshot',
            ref: source.snapshotId || source.locator || source.contentHash,
            hash: source.contentHash,
          },
          ...claims.map((claim) => ({
            kind: 'claim',
            ref: claim.id,
            hash: claim.claimHash,
          })),
        ],
        refs: {
          sourceLocator: source.locator,
          sourceSnapshotId: source.snapshotId,
          sourceHash: source.contentHash,
          candidateId: asTrimmed(input.candidateId),
          namespace: asTrimmed(input.namespace),
        },
      },
      refs: {
        candidateId: asTrimmed(input.candidateId),
        namespace: asTrimmed(input.namespace),
        reviewerHint: asTrimmed(input.reviewerHint),
      },
      payload: {
        title,
        claimCount: claims.length,
        claimsNeedingReview,
        policy,
        review,
        source,
        claims: claims.map((claim) => ({
          id: claim.id,
          claimHash: claim.claimHash,
          status: claim.status,
          confidence: claim.confidence,
          needsReview: claim.needsReview,
          reviewReasons: claim.reviewReasons,
        })),
      },
    });

    return compactObject({
      id,
      title,
      packHash,
      createdAt: issuedAt,
      candidateId: asTrimmed(input.candidateId),
      namespace: asTrimmed(input.namespace),
      sectorId: asTrimmed(input.sectorId),
      ontologyRef: asTrimmed(input.ontologyRef),
      source,
      claims,
      verdict,
      confidence,
      review,
      policy,
      metadata: input.metadata,
      receipt,
    });
  }

  async submitPack(
    input: EvidencePackInput,
  ): Promise<{ pack: EvidencePackRecord; duplicate: boolean }> {
    const draft = this.buildPack(input);
    const existing = await this.getPack(draft.id);
    if (existing) {
      if (existing.packHash !== draft.packHash) {
        throw new Error('Evidence pack ID conflict: existing pack has different contents.');
      }
      return { pack: existing, duplicate: true };
    }

    await Promise.all([
      redis.setex(evidencePackKey(draft.id), PACK_RETENTION_SECONDS, JSON.stringify(draft)),
      redis.zadd(PACK_INDEX_KEY, {
        score: Date.parse(draft.createdAt) || Date.now(),
        member: draft.id,
      }),
      redis.expire(PACK_INDEX_KEY, PACK_RETENTION_SECONDS),
    ]);

    return { pack: draft, duplicate: false };
  }

  async getPack(packId: string): Promise<EvidencePackRecord | null> {
    const raw = await redis.get(evidencePackKey(packId));
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) as EvidencePackRecord : raw as EvidencePackRecord;
  }

  async listPacks(filters: EvidencePackListFilters = {}): Promise<EvidencePackRecord[]> {
    const limit = normalizeLimit(filters.limit);
    const packIds = (await redis.zrange(PACK_INDEX_KEY, 0, -1, { rev: true })).map(String);
    const packs: EvidencePackRecord[] = [];

    for (const packId of packIds) {
      if (packs.length >= limit) break;
      const pack = await this.getPack(packId);
      if (!pack) continue;
      if (!matchesFilters(pack, filters)) continue;
      packs.push(pack);
    }

    return packs;
  }
}

export const evidencePackService = new EvidencePackService();
