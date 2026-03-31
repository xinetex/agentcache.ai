import { beforeEach, describe, expect, it } from 'vitest';
import { alignmentRoutingService } from '../../src/services/AlignmentRoutingService.js';
import { redis } from '../../src/lib/redis.js';
import { modelCompatibilityLabService } from '../../src/services/ModelCompatibilityLabService.js';

describe('alignment fabric services', () => {
  beforeEach(async () => {
    const keys = await redis.keys('alignment:pair:*');
    for (const key of keys) {
      await redis.del(key);
    }
    await redis.del('alignment:pairs:index');
  });

  it('scores native same-provider routes as fully compatible', async () => {
    const report = await modelCompatibilityLabService.score({
      sourceProvider: 'openai',
      targetProvider: 'openai',
      taskFamily: 'classification',
      privacyMode: 'plaintext',
      sensitivity: 'internal',
    });

    expect(report.compatible).toBe(true);
    expect(report.executionMode).toBe('native');
    expect(report.compatibilityScore).toBe(1);
    expect(report.verdict).toBe('PASS');
  });

  it('routes encrypted-linear classification through an approved provider pair', async () => {
    const decision = await alignmentRoutingService.route({
      prompt: 'Classify this banking support ticket by urgency.',
      taskFamily: 'classification',
      sectorHint: 'finance',
      sourceProvider: 'openai',
      sourceModel: 'text-embedding-3-small',
      allowedProviders: ['anthropic'],
      privacyMode: 'encrypted_linear',
      sensitivity: 'regulated',
      tierId: 'enterprise',
    });

    expect(decision.executionMode).toBe('encrypted_linear');
    expect(decision.verdict).toBe('PASS');
    expect(decision.chosenProvider).toBe('anthropic');
    expect(decision.receipt.subject.kind).toBe('ALIGNMENT_RUN');
    expect(decision.receipt.operation.sourceProvider).toBe('openai');
    expect(decision.receipt.operation.targetProvider).toBe('anthropic');
    expect(decision.receipt.payload?.policy).toBeDefined();
  });

  it('blocks encrypted-linear generation requests', async () => {
    const decision = await alignmentRoutingService.route({
      prompt: 'Write a full legal memo.',
      taskFamily: 'generation',
      sectorHint: 'legal',
      sourceProvider: 'openai',
      sourceModel: 'gpt-4o-mini',
      allowedProviders: ['anthropic'],
      privacyMode: 'encrypted_linear',
      sensitivity: 'regulated',
    });

    expect(decision.executionMode).toBe('blocked');
    expect(decision.verdict).toBe('BLOCK');
    expect(decision.notes.some((note) => note.toLowerCase().includes('encrypted-linear'))).toBe(true);
  });

  it('honors blocked pair overrides during scoring and routing', async () => {
    const { alignmentPersistenceService } = await import('../../src/services/AlignmentPersistenceService.js');

    await alignmentPersistenceService.upsertPair({
      id: 'openai-anthropic-classification',
      sourceProvider: 'openai',
      targetProvider: 'anthropic',
      taskFamily: 'classification',
      status: 'blocked',
      compatibilityScore: 0.2,
      tokenizerCompatibility: 0.83,
      representationSimilarity: 0.86,
      privateInferenceCapable: false,
      evidenceLevel: 'validated-v1',
      notes: ['Operator blocked this pair after local regression benchmarking.'],
    }, { updatedBy: 'test-suite' });

    const report = await modelCompatibilityLabService.score({
      sourceProvider: 'openai',
      targetProvider: 'anthropic',
      taskFamily: 'classification',
      privacyMode: 'encrypted_linear',
      sensitivity: 'regulated',
    });

    const decision = await alignmentRoutingService.route({
      prompt: 'Classify this insurance claim.',
      taskFamily: 'classification',
      sourceProvider: 'openai',
      allowedProviders: ['anthropic'],
      privacyMode: 'encrypted_linear',
      sensitivity: 'regulated',
    });

    expect(report.compatible).toBe(false);
    expect(report.verdict).toBe('BLOCK');
    expect(decision.executionMode).toBe('blocked');
  });
});
