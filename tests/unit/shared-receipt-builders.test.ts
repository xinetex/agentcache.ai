import { describe, expect, it } from 'vitest';
import {
  buildApiCallReceipt,
  buildBotCycleReceipt,
  buildPathologyRunReceipt,
  buildTrustExportReceipt,
} from '../../src/contracts/shared-receipt-builders.js';

describe('shared receipt builders', () => {
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
});
