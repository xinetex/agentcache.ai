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
  hashSharedReceipt,
  type SharedReceiptEnvelope,
  validateSharedReceiptEnvelope,
  verifySharedReceiptSignature,
} from '../contracts/shared-receipt.js';
import { redis } from '../lib/redis.js';

export type SharedReceiptSignatureStatus = 'verified' | 'unsigned' | 'unverifiable';

export type StoredSharedReceipt = {
  receipt: SharedReceiptEnvelope;
  receiptHash: string;
  ingestedAt: string;
  signatureStatus: SharedReceiptSignatureStatus;
  ingestedBy?: {
    apiKeyHash?: string;
    principalId?: string;
  };
};

export type SharedReceiptListFilters = {
  producerSystem?: string | null;
  subjectKind?: string | null;
  sectorId?: string | null;
  verdict?: string | null;
  limit?: number | null;
};

export type SharedReceiptSummary = {
  total: number;
  byProducerSystem: Array<{ system: string; count: number }>;
  bySubjectKind: Array<{ kind: string; count: number }>;
  byVerdict: Array<{ verdict: string; count: number }>;
  bySector: Array<{ sectorId: string; count: number }>;
};

const RECEIPT_RETENTION_SECONDS = 90 * 24 * 60 * 60;
const DEFAULT_LIST_LIMIT = 25;
const MAX_LIST_LIMIT = 100;
const INDEX_KEY = 'shared_receipts:index';

function receiptKey(receiptId: string): string {
  return `shared_receipt:${receiptId}`;
}

function normalizeLimit(limit?: number | null): number {
  if (!limit || !Number.isFinite(limit)) return DEFAULT_LIST_LIMIT;
  return Math.max(1, Math.min(MAX_LIST_LIMIT, Math.trunc(limit)));
}

function matchesFilters(record: StoredSharedReceipt, filters: SharedReceiptListFilters): boolean {
  if (filters.producerSystem && record.receipt.producer.system !== filters.producerSystem) return false;
  if (filters.subjectKind && record.receipt.subject.kind !== filters.subjectKind) return false;
  if (filters.sectorId && record.receipt.ontology?.sectorId !== filters.sectorId) return false;
  if (filters.verdict && record.receipt.trust.verdict !== filters.verdict) return false;
  return true;
}

function countBy(values: string[]): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, count]) => ({ key, count }));
}

export class SharedReceiptService {
  private getReceiptSecret(): string {
    return (process.env.SHARED_RECEIPT_SECRET || '').trim();
  }

  private computeSignatureStatus(receipt: SharedReceiptEnvelope): SharedReceiptSignatureStatus {
    const secret = this.getReceiptSecret();
    if (!receipt.signature) return 'unsigned';
    if (!secret) return 'unverifiable';
    return verifySharedReceiptSignature(receipt, secret) ? 'verified' : 'unverifiable';
  }

  async ingest(
    input: unknown,
    context?: { apiKey?: string | null; principalId?: string | null },
  ): Promise<{ stored: StoredSharedReceipt; duplicate: boolean }> {
    const validated = validateSharedReceiptEnvelope(input);
    if (!validated.success) {
      const issues = 'issues' in validated ? validated.issues : [];
      const message = issues.map((issue) => `${issue.path.join('.') || 'receipt'}: ${issue.message}`).join('; ');
      throw new Error(`Invalid shared receipt: ${message}`);
    }

    const signatureStatus = this.computeSignatureStatus(validated.receipt);
    if (validated.receipt.signature && this.getReceiptSecret() && signatureStatus !== 'verified') {
      throw new Error('Shared receipt signature is invalid.');
    }

    const { signature, ...unsigned } = validated.receipt;
    const receiptHash = hashSharedReceipt(unsigned);
    const existing = await this.get(validated.receipt.receiptId);

    if (existing) {
      if (existing.receiptHash !== receiptHash) {
        throw new Error('Receipt ID conflict: existing receipt has different contents.');
      }
      return { stored: existing, duplicate: true };
    }

    const stored: StoredSharedReceipt = {
      receipt: validated.receipt,
      receiptHash,
      ingestedAt: new Date().toISOString(),
      signatureStatus,
      ingestedBy: {
        apiKeyHash: context?.apiKey ? createHash('sha256').update(context.apiKey).digest('hex') : undefined,
        principalId: context?.principalId || undefined,
      },
    };

    await Promise.all([
      redis.setex(receiptKey(validated.receipt.receiptId), RECEIPT_RETENTION_SECONDS, JSON.stringify(stored)),
      redis.zadd(INDEX_KEY, {
        score: Date.parse(validated.receipt.issuedAt) || Date.now(),
        member: validated.receipt.receiptId,
      }),
      redis.expire(INDEX_KEY, RECEIPT_RETENTION_SECONDS),
    ]);

    return { stored, duplicate: false };
  }

  async get(receiptId: string): Promise<StoredSharedReceipt | null> {
    const raw = await redis.get(receiptKey(receiptId));
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) as StoredSharedReceipt : raw as StoredSharedReceipt;
  }

  async list(filters: SharedReceiptListFilters = {}): Promise<StoredSharedReceipt[]> {
    const limit = normalizeLimit(filters.limit);
    const receiptIds = (await redis.zrange(INDEX_KEY, 0, -1, { rev: true })).map(String);
    const records: StoredSharedReceipt[] = [];

    for (const receiptId of receiptIds) {
      if (records.length >= limit) break;
      const record = await this.get(receiptId);
      if (!record) continue;
      if (!matchesFilters(record, filters)) continue;
      records.push(record);
    }

    return records;
  }

  async getSummary(filters: SharedReceiptListFilters = {}): Promise<SharedReceiptSummary> {
    const records = await this.list({ ...filters, limit: MAX_LIST_LIMIT });

    return {
      total: records.length,
      byProducerSystem: countBy(records.map((record) => record.receipt.producer.system)).map(({ key, count }) => ({
        system: key,
        count,
      })),
      bySubjectKind: countBy(records.map((record) => record.receipt.subject.kind)).map(({ key, count }) => ({
        kind: key,
        count,
      })),
      byVerdict: countBy(records.map((record) => record.receipt.trust.verdict)).map(({ key, count }) => ({
        verdict: key,
        count,
      })),
      bySector: countBy(records.map((record) => record.receipt.ontology?.sectorId || '')).map(({ key, count }) => ({
        sectorId: key,
        count,
      })),
    };
  }
}

export const sharedReceiptService = new SharedReceiptService();
