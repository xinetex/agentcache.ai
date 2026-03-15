import { beforeEach, describe, expect, it } from 'vitest';
import {
  attachSharedReceiptSignature,
  buildSharedReceipt,
  type SharedReceiptEnvelope,
} from '../../src/contracts/shared-receipt.js';
import { redis } from '../../src/lib/redis.js';
import { sharedReceiptService } from '../../src/services/SharedReceiptService.js';

function buildFixtureReceipt(overrides: Partial<SharedReceiptEnvelope> = {}): SharedReceiptEnvelope {
  return {
    ...buildSharedReceipt({
      receiptId: `receipt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      issuedAt: new Date().toISOString(),
      producer: {
        system: 'JETTYAGENT',
        id: 'maxxpoly',
        role: 'autopilot',
      },
      subject: {
        kind: 'BOT_CYCLE',
        id: 'cycle-001',
      },
      operation: {
        action: 'autopilot.tick',
        environment: 'prod',
      },
      ontology: {
        sectorId: 'finance',
        ontologyRef: 'finance@v1',
        confidence: 0.92,
      },
      trust: {
        verdict: 'INFO',
        confidence: 0.8,
      },
      telemetry: {
        pnlUsd: 4.25,
      },
    }),
    ...overrides,
  };
}

describe('SharedReceiptService', () => {
  beforeEach(async () => {
    process.env.SHARED_RECEIPT_SECRET = '';
    const keys = await redis.keys('shared_receipt:*');
    const indexKeys = await redis.keys('shared_receipts:*');
    for (const key of [...keys, ...indexKeys]) {
      await redis.del(String(key));
    }
  });

  it('ingests, deduplicates, and lists shared receipts', async () => {
    const receipt = buildFixtureReceipt();

    const first = await sharedReceiptService.ingest(receipt, { apiKey: 'ac_demo_test123' });
    const second = await sharedReceiptService.ingest(receipt, { apiKey: 'ac_demo_test123' });
    const listed = await sharedReceiptService.list({ producerSystem: 'JETTYAGENT' });

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(first.stored.receiptHash).toBe(second.stored.receiptHash);
    expect(listed).toHaveLength(1);
    expect(listed[0].receipt.subject.kind).toBe('BOT_CYCLE');
  });

  it('verifies signed receipts when a shared receipt secret is configured', async () => {
    process.env.SHARED_RECEIPT_SECRET = 'test-shared-receipt-secret';
    const unsigned = buildFixtureReceipt();
    const signed = attachSharedReceiptSignature(unsigned, process.env.SHARED_RECEIPT_SECRET);

    const ingested = await sharedReceiptService.ingest(signed, {
      apiKey: 'ac_demo_test123',
      principalId: 'agent:test-agent',
    });

    expect(ingested.duplicate).toBe(false);
    expect(ingested.stored.signatureStatus).toBe('verified');
    expect(ingested.stored.ingestedBy?.principalId).toBe('agent:test-agent');
  });

  it('rejects conflicting receipt ids with different payloads', async () => {
    const receipt = buildFixtureReceipt({ receiptId: 'conflict-receipt' });
    await sharedReceiptService.ingest(receipt, { apiKey: 'ac_demo_test123' });

    await expect(sharedReceiptService.ingest({
      ...receipt,
      telemetry: { pnlUsd: 99 },
    }, { apiKey: 'ac_demo_test123' })).rejects.toThrow('Receipt ID conflict');
  });
});
