import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validateSharedReceiptEnvelope } from '../../src/contracts/shared-receipt.js';
import { redis } from '../../src/lib/redis.js';
import { CortexEvolutionService } from '../../src/services/CortexEvolutionService.js';
import { sharedReceiptService } from '../../src/services/SharedReceiptService.js';

function baseDeps(overrides: Record<string, any> = {}) {
  return {
    redisClient: redis,
    receiptService: sharedReceiptService,
    upsertMemoryFn: vi.fn(async () => undefined),
    ...overrides,
  } as any;
}

describe('cortex evolution service', () => {
  beforeEach(async () => {
    const keys = await redis.keys('cortex:evolution:*');
    const receiptKeys = await redis.keys('shared_receipt:*');
    for (const key of [...keys, ...receiptKeys, 'shared_receipts:index']) {
      await redis.del(key);
    }
    vi.restoreAllMocks();
  });

  it('creates a DGM-inspired evolution run with sandbox guardrails and a receipt', async () => {
    const service = new CortexEvolutionService(baseDeps());

    const run = await service.createRun({
      objective: 'Evolve the Cortex planner without production side effects.',
      maxGenerations: 3,
      candidatesPerGeneration: 2,
    }, { apiKey: 'ac_demo_test', principalId: 'agent:test' });

    expect(run.status).toBe('active');
    expect(run.sourceRepository).toBe('https://github.com/jennyzzt/dgm');
    expect(run.safetyPolicy.sandboxRequired).toBe(true);
    expect(run.safetyPolicy.humanReviewRequired).toBe(true);
    expect(run.benchmarkProfile.commands.map((command) => command.id)).toContain('build');

    const storedReceipt = await sharedReceiptService.get(run.receiptId);
    expect(storedReceipt?.receipt.operation.action).toBe('cortex.evolution.run.create');
    expect(validateSharedReceiptEnvelope(storedReceipt?.receipt).success).toBe(true);
  });

  it('promotes a candidate only after required checks pass', async () => {
    const upsertMemoryFn = vi.fn(async () => undefined);
    const service = new CortexEvolutionService(baseDeps({ upsertMemoryFn }));
    const run = await service.createRun({
      objective: 'Improve Cortex memory scoring.',
    });
    const candidate = await service.proposeCandidate({
      runId: run.id,
      summary: 'Tune Cortex memory scoring and add focused tests.',
      changedFiles: [
        'src/services/CortexRuntimeService.ts',
        'tests/unit/cortex-runtime-service.test.ts',
      ],
      patchBytes: 18_000,
      branchName: 'codex/evolve-cortex-memory',
    });

    expect(candidate.status).toBe('proposed');
    expect(candidate.risk).toBe('medium');

    const evaluated = await service.recordEvaluation({
      runId: run.id,
      candidateId: candidate.id,
      benchmarkResults: [
        { id: 'cortex-unit', status: 'passed', durationMs: 1000 },
        { id: 'cortex-types', status: 'passed', durationMs: 900 },
        { id: 'build', status: 'passed', durationMs: 9000 },
      ],
    });

    expect(evaluated.candidate.status).toBe('promotable');
    expect(evaluated.candidate.score).toBeGreaterThanOrEqual(0.92);
    expect(evaluated.run.status).toBe('awaiting_review');
    expect(evaluated.receipt.trust.verdict).toBe('PASS');
    expect(upsertMemoryFn).toHaveBeenCalled();
  });

  it('rejects candidates with failed required checks', async () => {
    const service = new CortexEvolutionService(baseDeps());
    const run = await service.createRun({
      objective: 'Improve API route ergonomics safely.',
    });
    const candidate = await service.proposeCandidate({
      runId: run.id,
      summary: 'Refactor Cortex API validation.',
      changedFiles: ['src/api/cortex.ts'],
    });

    const evaluated = await service.recordEvaluation({
      runId: run.id,
      candidateId: candidate.id,
      benchmarkResults: [
        { id: 'cortex-unit', status: 'passed' },
        { id: 'cortex-types', status: 'failed', exitCode: 2, summary: 'Type error' },
        { id: 'build', status: 'passed' },
      ],
    });

    expect(evaluated.candidate.status).toBe('rejected');
    expect(evaluated.candidate.verification.notes.join(' ')).toContain('cortex-types');
    expect(evaluated.receipt.trust.verdict).toBe('REVIEW');
  });

  it('blocks candidates that touch forbidden secret paths', async () => {
    const service = new CortexEvolutionService(baseDeps());
    const run = await service.createRun({
      objective: 'Test forbidden path controls.',
    });

    const candidate = await service.proposeCandidate({
      runId: run.id,
      summary: 'Accidentally change secrets.',
      changedFiles: ['.env.production'],
    });

    expect(candidate.status).toBe('blocked');
    expect(candidate.verification.verdict).toBe('BLOCK');

    const evaluated = await service.recordEvaluation({
      runId: run.id,
      candidateId: candidate.id,
      benchmarkResults: [
        { id: 'cortex-unit', status: 'passed' },
        { id: 'cortex-types', status: 'passed' },
        { id: 'build', status: 'passed' },
      ],
    });

    expect(evaluated.candidate.status).toBe('blocked');
    expect(evaluated.receipt.trust.verdict).toBe('BLOCK');
  });
});
