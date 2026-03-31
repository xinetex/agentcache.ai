import { describe, expect, it } from 'vitest';
import {
  buildAlignmentRunReceipt,
  buildApiCallReceipt,
  buildBotCycleReceipt,
  buildContextPackVersionReceipt,
  buildExecutionReviewReceipt,
  buildExecutionRunReceipt,
  buildGateDecisionReceipt,
  buildPathologyRunReceipt,
  buildSoulprintScanReceipt,
  buildStorageTransferReceipt,
  buildTrustExportReceipt,
} from '../../src/contracts/shared-receipt-builders.js';

describe('shared receipt builders', () => {
  it('builds an alignment run receipt with cross-provider metadata', () => {
    const receipt = buildAlignmentRunReceipt({
      receiptId: 'alignment-001',
      producer: {
        system: 'AGENTCACHE',
        id: 'agentcache.ai',
        role: 'alignment-router',
      },
      runId: 'align-run-001',
      route: '/api/alignment/route',
      sourceProvider: 'openai',
      sourceModel: 'text-embedding-3-small',
      targetProvider: 'anthropic',
      targetModel: 'claude-3-5-sonnet',
      executionMode: 'encrypted_linear',
      privacyMode: 'encrypted_linear',
      trust: {
        verdict: 'PASS',
        confidence: 0.88,
      },
    });

    expect(receipt.subject.kind).toBe('ALIGNMENT_RUN');
    expect(receipt.operation.action).toBe('alignment.route');
    expect(receipt.operation.sourceProvider).toBe('openai');
    expect(receipt.operation.targetProvider).toBe('anthropic');
    expect(receipt.operation.executionMode).toBe('encrypted_linear');
  });

  it('builds a signed bot cycle receipt', () => {
    const receipt = buildBotCycleReceipt({
      receiptId: 'cycle-001',
      producer: {
        system: 'JETTYAGENT',
        id: 'maxxpoly',
      },
      cycleId: 'cycle-001',
      trust: {
        verdict: 'INFO',
      },
      secret: 'builder-secret',
    });

    expect(receipt.subject.kind).toBe('BOT_CYCLE');
    expect(receipt.operation.action).toBe('bot.cycle');
    expect(typeof receipt.signature).toBe('string');
  });

  it('builds an api call receipt with routing metadata', () => {
    const receipt = buildApiCallReceipt({
      receiptId: 'call-001',
      producer: {
        system: 'MAXXEVAL',
        id: 'trustops',
      },
      callId: 'call-001',
      route: '/api/x402/v1/agentcache/cache/get',
      provider: 'agentcache',
      trust: {
        verdict: 'PASS',
      },
    });

    expect(receipt.subject.kind).toBe('API_CALL');
    expect(receipt.operation.provider).toBe('agentcache');
    expect(receipt.operation.route).toBe('/api/x402/v1/agentcache/cache/get');
  });

  it('builds a trust export receipt', () => {
    const receipt = buildTrustExportReceipt({
      receiptId: 'trust-001',
      producer: {
        system: 'MAXXEVAL',
        id: 'trustops',
      },
      exportId: 'trust-001',
      trust: {
        verdict: 'PASS',
        confidence: 0.92,
      },
    });

    expect(receipt.subject.kind).toBe('TRUST_EXPORT');
    expect(receipt.operation.action).toBe('trust.export');
    expect(receipt.trust.confidence).toBe(0.92);
  });

  it('builds a pathology run receipt', () => {
    const receipt = buildPathologyRunReceipt({
      receiptId: 'pathology-001',
      producer: {
        system: 'AGENTCACHE',
        id: 'agentcache.ai',
      },
      runId: 'pathology-run-001',
      route: '/api/pathological/assess',
      trust: {
        verdict: 'REVIEW',
        anomalyScore: 0.72,
      },
    });

    expect(receipt.subject.kind).toBe('PATHOLOGY_RUN');
    expect(receipt.operation.action).toBe('pathology.assess');
    expect(receipt.operation.route).toBe('/api/pathological/assess');
    expect(receipt.trust.anomalyScore).toBe(0.72);
  });

  it('builds a storage transfer receipt with lyve metadata', () => {
    const receipt = buildStorageTransferReceipt({
      receiptId: 'storage-001',
      producer: {
        system: 'JETTYAGENT',
        id: 'maxxeval.com',
        role: 'storage-runtime',
      },
      transferId: 'transfer-001',
      route: '/api/jetty-speed/chunk',
      provider: 'lyve',
      direction: 'upload',
      storageClass: 'durable-object',
      trust: {
        verdict: 'PASS',
        confidence: 0.88,
      },
      refs: {
        bucket: 'jettydata-prod',
        fileId: 'file-123',
      },
    });

    expect(receipt.subject.kind).toBe('STORAGE_TRANSFER');
    expect(receipt.operation.provider).toBe('lyve');
    expect(receipt.operation.route).toBe('/api/jetty-speed/chunk');
    expect(receipt.payload?.direction).toBe('upload');
    expect(receipt.payload?.storageClass).toBe('durable-object');
  });

  it('builds a soulprint scan receipt', () => {
    const receipt = buildSoulprintScanReceipt({
      receiptId: 'soulprint-001',
      producer: {
        system: 'AGENTCACHE',
        id: 'agentcache.ai',
        role: 'preregistration-auditor',
      },
      scanId: 'registration-001:scan-001',
      route: '/api/external-agents/registration-001/soulprint',
      trust: {
        verdict: 'PASS',
        confidence: 0.87,
      },
      refs: {
        externalSystem: 'moltbook',
        externalAgentId: 'bot-77',
      },
      payload: {
        findings: ['Escalates aggressively under low-confidence states'],
      },
    });

    expect(receipt.subject.kind).toBe('SOULPRINT_SCAN');
    expect(receipt.operation.action).toBe('soulprint.scan');
    expect(receipt.operation.route).toBe('/api/external-agents/registration-001/soulprint');
    expect(receipt.payload?.findings).toEqual(['Escalates aggressively under low-confidence states']);
  });

  it('builds execution control receipts', () => {
    const versionReceipt = buildContextPackVersionReceipt({
      receiptId: 'ctxv-001',
      producer: {
        system: 'AGENTCACHE',
        id: 'agentcache.ai',
      },
      versionId: 'ctxv-001',
      contextPackId: 'ctx-001',
      route: '/api/execution/context-packs',
      trust: {
        verdict: 'PASS',
      },
    });

    const runReceipt = buildExecutionRunReceipt({
      receiptId: 'run-001',
      producer: {
        system: 'AGENTCACHE',
        id: 'agentcache.ai',
      },
      runId: 'run-001',
      contextPackVersionId: 'ctxv-001',
      executionMode: 'gated',
      trust: {
        verdict: 'REVIEW',
      },
    });

    const reviewReceipt = buildExecutionReviewReceipt({
      receiptId: 'review-001',
      producer: {
        system: 'AGENTCACHE',
        id: 'agentcache.ai',
      },
      reviewId: 'review-001',
      runId: 'run-001',
      reviewerRole: 'critical',
      trust: {
        verdict: 'PASS',
      },
    });

    const gateReceipt = buildGateDecisionReceipt({
      receiptId: 'gate-001',
      producer: {
        system: 'AGENTCACHE',
        id: 'agentcache.ai',
      },
      gateId: 'gate-001',
      runId: 'run-001',
      gateType: 'publish',
      trust: {
        verdict: 'PASS',
      },
    });

    expect(versionReceipt.subject.kind).toBe('CONTEXT_PACK_VERSION');
    expect(runReceipt.subject.kind).toBe('EXECUTION_RUN');
    expect(runReceipt.operation.executionMode).toBe('gated');
    expect(reviewReceipt.subject.kind).toBe('EXECUTION_REVIEW');
    expect(reviewReceipt.refs?.reviewerRole).toBe('critical');
    expect(gateReceipt.subject.kind).toBe('GATE_DECISION');
    expect(gateReceipt.refs?.gateType).toBe('publish');
  });
});
