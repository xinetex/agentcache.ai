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

  it('summarizes storage transfer receipts by direction and tenant scope', async () => {
    const storageReceipt = buildFixtureReceipt({
      receiptId: 'storage-transfer-001',
      subject: {
        kind: 'STORAGE_TRANSFER',
        id: 'storage.upload_file:tenants/9/users/42/files/test.bin',
        route: '/api/jetty-speed/chunk',
      },
      operation: {
        action: 'storage.upload_file',
        provider: 'lyve',
        route: '/api/jetty-speed/chunk',
        method: 'PUT',
        environment: 'production',
      },
      refs: {
        direction: 'upload',
        namespace: 'tenant',
        tenantId: 9,
        userId: 42,
      },
    });

    await sharedReceiptService.ingest(storageReceipt, { apiKey: 'ac_demo_test123' });

    const summary = await sharedReceiptService.getSummary({
      producerSystem: 'JETTYAGENT',
    });

    expect(summary.storage.transfers).toBeGreaterThanOrEqual(1);
    expect(summary.storage.byDirection).toEqual(
      expect.arrayContaining([{ direction: 'upload', count: 1 }]),
    );
    expect(summary.storage.byNamespace).toEqual(
      expect.arrayContaining([{ namespace: 'tenant', count: 1 }]),
    );
    expect(summary.storage.byTenantId).toEqual(
      expect.arrayContaining([{ tenantId: '9', count: 1 }]),
    );
  });

  it('summarizes commerce lifecycle receipts by action and actor scope', async () => {
    const createdReceipt = buildFixtureReceipt({
      receiptId: 'commerce-create-001',
      producer: {
        system: 'MAXXEVAL',
        id: 'maxxeval.com',
        role: 'trust-commerce-layer',
      },
      subject: {
        kind: 'API_CALL',
        id: 'job-order-001',
        route: '/api/job-orders',
      },
      operation: {
        action: 'CREATE_JOB_ORDER',
        provider: 'maxxeval',
        route: '/api/job-orders',
        method: 'POST',
        environment: 'production',
      },
      refs: {
        buyerId: 'buyer-7',
        sellerAgentProfileId: 'seller-9',
        escrowStatus: 'PENDING',
      },
    });

    const releaseReceipt = buildFixtureReceipt({
      receiptId: 'commerce-release-001',
      producer: {
        system: 'MAXXEVAL',
        id: 'maxxeval.com',
        role: 'trust-commerce-layer',
      },
      subject: {
        kind: 'API_CALL',
        id: 'job-order-001',
        route: '/api/job-orders/[id]',
      },
      operation: {
        action: 'RELEASE_ESCROW',
        provider: 'maxxeval',
        route: '/api/job-orders/[id]',
        method: 'PATCH',
        environment: 'production',
      },
      refs: {
        buyerId: 'buyer-7',
        sellerAgentProfileId: 'seller-9',
        escrowStatus: 'RELEASED',
      },
      trust: {
        verdict: 'PASS',
        confidence: 0.97,
      },
    });

    await sharedReceiptService.ingest(createdReceipt, { apiKey: 'ac_demo_test123' });
    await sharedReceiptService.ingest(releaseReceipt, { apiKey: 'ac_demo_test123' });

    const summary = await sharedReceiptService.getSummary({
      producerSystem: 'MAXXEVAL',
    });

    expect(summary.commerce.lifecycleEvents).toBe(2);
    expect(summary.commerce.byAction).toEqual(
      expect.arrayContaining([
        { action: 'CREATE_JOB_ORDER', count: 1 },
        { action: 'RELEASE_ESCROW', count: 1 },
      ]),
    );
    expect(summary.commerce.byEscrowStatus).toEqual(
      expect.arrayContaining([
        { status: 'PENDING', count: 1 },
        { status: 'RELEASED', count: 1 },
      ]),
    );
    expect(summary.commerce.byBuyerId).toEqual(
      expect.arrayContaining([{ buyerId: 'buyer-7', count: 2 }]),
    );
    expect(summary.commerce.bySellerAgentProfileId).toEqual(
      expect.arrayContaining([{ sellerAgentProfileId: 'seller-9', count: 2 }]),
    );
  });

  it('summarizes browser proof receipts by execution mode and engine quality', async () => {
    const browserReceipt = buildFixtureReceipt({
      receiptId: 'browser-proof-001',
      producer: {
        system: 'MAXXEVAL',
        id: 'maxxeval.com',
        role: 'trust-commerce-layer',
      },
      subject: {
        kind: 'BROWSER_TASK',
        id: 'agentcache-browser-proof:001',
        route: '/api/x402/v1/agentcache/browser/proof',
      },
      operation: {
        action: 'CAPTURE_BROWSER_PROOF',
        provider: 'agentcache',
        route: '/api/x402/v1/agentcache/browser/proof',
        method: 'GET',
        environment: 'production',
      },
      trust: {
        verdict: 'PASS',
        confidence: 0.96,
        status: 'stable',
      },
      payload: {
        executionMode: 'lightpanda+firecrawl+http',
        engine: 'lightpanda',
      },
    });

    await sharedReceiptService.ingest(browserReceipt, { apiKey: 'ac_demo_test123' });

    const summary = await sharedReceiptService.getSummary({
      producerSystem: 'MAXXEVAL',
    });

    expect(summary.browser.proofs).toBe(1);
    expect(summary.browser.byExecutionMode).toEqual(
      expect.arrayContaining([{ executionMode: 'lightpanda+firecrawl+http', count: 1 }]),
    );
    expect(summary.browser.byEngine).toEqual(
      expect.arrayContaining([{ engine: 'lightpanda', count: 1 }]),
    );
    expect(summary.browser.byHomeostasisStatus).toEqual(
      expect.arrayContaining([{ status: 'stable', count: 1 }]),
    );
  });

  it('accepts soulprint scan receipts as first-class trust evidence', async () => {
    const soulprintReceipt = buildFixtureReceipt({
      receiptId: 'soulprint-scan-001',
      producer: {
        system: 'AGENTCACHE',
        id: 'agentcache.ai',
        role: 'preregistration-auditor',
      },
      subject: {
        kind: 'SOULPRINT_SCAN',
        id: 'registration-001:scan-001',
        route: '/api/external-agents/registration-001/soulprint',
      },
      operation: {
        action: 'soulprint.scan',
        route: '/api/external-agents/registration-001/soulprint',
        method: 'POST',
        environment: 'production',
      },
      refs: {
        registrationId: 'registration-001',
        externalSystem: 'moltbook',
        externalAgentId: 'bot-44',
      },
    });

    const ingested = await sharedReceiptService.ingest(soulprintReceipt, { apiKey: 'ac_demo_test123' });
    const fetched = await sharedReceiptService.get(ingested.stored.receipt.receiptId);

    expect(fetched?.receipt.subject.kind).toBe('SOULPRINT_SCAN');
    expect(fetched?.receipt.operation.action).toBe('soulprint.scan');
    expect(fetched?.receipt.refs?.externalSystem).toBe('moltbook');
  });
});
