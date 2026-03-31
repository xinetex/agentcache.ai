import { beforeEach, describe, expect, it } from 'vitest';
import { redis } from '../../src/lib/redis.js';
import { alignmentPersistenceService } from '../../src/services/AlignmentPersistenceService.js';
import { alignmentRoutingService } from '../../src/services/AlignmentRoutingService.js';

describe('alignment persistence service', () => {
  beforeEach(async () => {
    const runKeys = await redis.keys('alignment:run:*');
    const benchmarkKeys = await redis.keys('alignment:benchmark:*');
    const pairKeys = await redis.keys('alignment:pair:*');
    const indexKeys = await redis.keys('alignment:*:index');
    for (const key of [...runKeys, ...benchmarkKeys, ...pairKeys, ...indexKeys]) {
      await redis.del(key);
    }
  });

  it('records route decisions and benchmarks and summarizes them', async () => {
    const decision = await alignmentRoutingService.route({
      prompt: 'Classify this patient note by risk.',
      taskFamily: 'classification',
      sectorHint: 'healthcare',
      sourceProvider: 'openai',
      allowedProviders: ['anthropic'],
      privacyMode: 'encrypted_linear',
      sensitivity: 'regulated',
      tierId: 'enterprise',
    });

    await alignmentPersistenceService.recordRun(decision, { principalId: 'org:test' });
    await alignmentPersistenceService.recordBenchmark({
      pairId: 'openai-anthropic-classification',
      sourceProvider: 'openai',
      targetProvider: 'anthropic',
      taskFamily: 'classification',
      baselineScore: 0.91,
      alignedScore: 0.87,
      status: 'validated',
    });

    const summary = await alignmentPersistenceService.getSummary();
    expect(summary.totalRuns).toBeGreaterThanOrEqual(1);
    expect(summary.encryptedLinearRuns).toBeGreaterThanOrEqual(1);
    expect(summary.storedBenchmarks).toBeGreaterThanOrEqual(1);
    expect(summary.byVerdict.some((entry) => entry.verdict === 'PASS')).toBe(true);
  });

  it('merges operator overrides into the effective pair catalog', async () => {
    await alignmentPersistenceService.upsertPair({
      id: 'openai-gemini-classification',
      sourceProvider: 'openai',
      targetProvider: 'gemini',
      taskFamily: 'classification',
      status: 'validated',
      compatibilityScore: 0.9,
      tokenizerCompatibility: 0.82,
      representationSimilarity: 0.88,
      privateInferenceCapable: true,
      evidenceLevel: 'validated-v1',
      notes: ['Locally benchmarked and approved.'],
    }, { updatedBy: 'test-suite' });

    const pair = await alignmentPersistenceService.findEffectivePair({
      sourceProvider: 'openai',
      targetProvider: 'gemini',
      taskFamily: 'classification',
    });

    expect(pair?.status).toBe('validated');
    expect(pair?.compatibilityScore).toBe(0.9);
    expect(pair?.notes[0]).toContain('approved');
  });
});
