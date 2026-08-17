import { beforeEach, describe, expect, it } from 'vitest';
import { redis } from '../../src/lib/redis.js';
import { evidencePackService } from '../../src/services/EvidencePackService.js';

async function clearEvidenceState() {
  const keys = await redis.keys('evidence_pack:*');
  const indexKeys = await redis.keys('evidence_packs:*');
  const receiptKeys = await redis.keys('shared_receipt:*');
  const receiptIndexKeys = await redis.keys('shared_receipts:*');
  for (const key of [...keys, ...indexKeys, ...receiptKeys, ...receiptIndexKeys]) {
    await redis.del(String(key));
  }
}

function passPackInput() {
  return {
    title: 'AgentCache Knowledge answer',
    source: {
      locator: 'https://agentcache.ai/docs/knowledge',
      content: 'Evidence Packs bind claims to source hashes and shared receipts.',
      mimeType: 'text/plain',
      retrievedAt: '2026-08-17T12:00:00.000Z',
    },
    claims: [
      {
        id: 'claim-cache-1',
        text: 'Evidence Packs bind claims to source hashes and shared receipts.',
        sourceRef: 'docs/knowledge#evidence-packs',
        spans: [{ start: 0, end: 63 }],
        confidence: 0.94,
        status: 'supported',
      },
    ],
    namespace: 'agentcache-docs',
    sectorId: 'ai-infrastructure',
    ontologyRef: 'agentcache-knowledge@v1',
    candidateId: 'answer-001',
  };
}

describe('EvidencePackService', () => {
  beforeEach(async () => {
    await clearEvidenceState();
  });

  it('creates source-bound packs with receipts and no raw source content', async () => {
    const result = await evidencePackService.submitPack(passPackInput());

    expect(result.duplicate).toBe(false);
    expect(result.pack.id).toMatch(/^evpack_/);
    expect(result.pack.verdict).toBe('PASS');
    expect(result.pack.confidence).toBe(0.94);
    expect(result.pack.policy).toMatchObject({
      liveFetch: false,
      canonicalWrite: false,
      sourceBound: true,
      humanPromotionRequired: true,
    });
    expect((result.pack.source as any).content).toBeUndefined();
    expect(result.pack.source.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.pack.receipt.subject.kind).toBe('EVIDENCE_PACK');
    expect(result.pack.receipt.operation.action).toBe('evidence.pack.create');
    expect(result.pack.receipt.economics?.sku).toBe('evidence-claim');
    expect(result.pack.receipt.economics?.tokenCost).toBe(1);
    expect(result.pack.receipt.evidence?.payloadHash).toBe(result.pack.packHash);
  });

  it('deduplicates repeated evidence packs by deterministic pack hash', async () => {
    const input = passPackInput();
    const first = await evidencePackService.submitPack(input);
    const second = await evidencePackService.submitPack(input);

    expect(second.duplicate).toBe(true);
    expect(second.pack.id).toBe(first.pack.id);
    expect(second.pack.packHash).toBe(first.pack.packHash);
    expect(second.pack.createdAt).toBe(first.pack.createdAt);
    expect(second.pack.receipt.issuedAt).toBe(first.pack.receipt.issuedAt);
  });

  it('marks weakly anchored claims for review', async () => {
    const result = await evidencePackService.submitPack({
      title: 'Unanchored summary',
      source: {
        content: 'A source body can be hashed without storing raw source content.',
      },
      claims: [
        {
          text: 'The source says AgentCache should promote this immediately.',
          confidence: 0.61,
          status: 'supported',
        },
      ],
      sectorId: 'ai-infrastructure',
    });

    expect(result.pack.verdict).toBe('REVIEW');
    expect(result.pack.policy.sourceBound).toBe(false);
    expect(result.pack.review.action).toBe('human_review');
    expect(result.pack.claims[0].needsReview).toBe(true);
    expect(result.pack.claims[0].reviewReasons).toEqual(
      expect.arrayContaining(['low_confidence', 'missing_claim_anchor', 'source_not_locator_bound']),
    );
  });

  it('blocks contradicted claims', async () => {
    const result = await evidencePackService.submitPack({
      ...passPackInput(),
      title: 'Contradicted answer',
      claims: [
        {
          text: 'This claim conflicts with the cited source.',
          sourceRef: 'docs/knowledge#evidence-packs',
          spans: [{ start: 0, end: 10 }],
          confidence: 0.9,
          status: 'contradicted',
        },
      ],
    });

    expect(result.pack.verdict).toBe('BLOCK');
    expect(result.pack.review.action).toBe('reject_or_rework');
    expect(result.pack.receipt.operation.statusCode).toBe(422);
  });
});
