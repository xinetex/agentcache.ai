import { beforeEach, describe, expect, it } from 'vitest';
import { redis } from '../../src/lib/redis.js';
import { certifiedRunService } from '../../src/services/CertifiedRunService.js';
import { evidencePackService } from '../../src/services/EvidencePackService.js';
import { sharedReceiptService } from '../../src/services/SharedReceiptService.js';

async function clearState() {
  const keys = await redis.keys('certified_run:*');
  const indexes = await redis.keys('certified_runs:*');
  const evidence = await redis.keys('evidence_pack:*');
  const evidenceIndexes = await redis.keys('evidence_packs:*');
  const receipts = await redis.keys('shared_receipt:*');
  const receiptIndexes = await redis.keys('shared_receipts:*');
  for (const key of [...keys, ...indexes, ...evidence, ...evidenceIndexes, ...receipts, ...receiptIndexes]) await redis.del(String(key));
}

async function createEvidencePack() {
  const result = await evidencePackService.submitPack({
    title: 'Certified source',
    source: { locator: 'https://example.com/policy', content: 'The policy requires human approval for external writes.' },
    claims: [{ text: 'The policy requires human approval for external writes.', sourceRef: '#approval', spans: [{ start: 0, end: 54 }], confidence: 0.96, status: 'SUPPORTED' }],
    namespace: 'trust-ledger-test',
  });
  await sharedReceiptService.ingest(result.pack.receipt);
  return result.pack;
}

describe('CertifiedRunService', () => {
  beforeEach(clearState);

  it('creates a hash-only, evidence-backed run requiring approval', async () => {
    const pack = await createEvidencePack();
    const result = await certifiedRunService.createRun({
      title: 'Publish policy answer',
      intent: 'Publish the approved policy answer to the customer workspace.',
      evidencePackIds: [pack.id],
      actions: [{ tool: 'workspace.publish', operation: 'create_document', risk: 'high', arguments: { secret: 'must-not-persist' }, result: { documentId: 'doc-1' } }],
      policy: { allowedTools: ['workspace.publish'], maxRisk: 'high', requireHumanApproval: true },
    });

    expect(result.duplicate).toBe(false);
    expect(result.run.id).toMatch(/^cert_/);
    expect(result.run.status).toBe('pending_approval');
    expect(result.run.verdict).toBe('REVIEW');
    expect(result.run.evidence[0].packId).toBe(pack.id);
    expect(result.run.actions[0].argumentsHash).toMatch(/^[a-f0-9]{64}$/);
    expect((result.run.actions[0] as any).arguments).toBeUndefined();
    expect((result.run.actions[0] as any).result).toBeUndefined();
    expect(result.run.policy.canonicalWrite).toBe(false);
    expect(result.run.receipt.subject.kind).toBe('CERTIFIED_RUN');

    const approved = await certifiedRunService.decideRun(result.run.id, 'approved', { decidedBy: 'reviewer-1', note: 'Source and action scope verified.' });
    expect(approved.run.status).toBe('approved');
    expect(approved.run.verdict).toBe('PASS');
    expect(approved.decisionReceipt.operation.action).toBe('agent.run.approved');
  });

  it('blocks disallowed tools and deduplicates the same ledger', async () => {
    const input = {
      title: 'Blocked export',
      intent: 'Export customer data.',
      actions: [{ tool: 'unknown.export', operation: 'export', risk: 'critical' }],
      policy: { allowedTools: ['workspace.read'], maxRisk: 'high', requireHumanApproval: true },
    };
    const first = await certifiedRunService.createRun(input);
    const second = await certifiedRunService.createRun(input);
    expect(first.run.status).toBe('blocked');
    expect(first.run.verdict).toBe('BLOCK');
    expect(first.run.approval.decision).toBe('rejected');
    expect(second.duplicate).toBe(true);
    expect(second.run.id).toBe(first.run.id);
  });
});
