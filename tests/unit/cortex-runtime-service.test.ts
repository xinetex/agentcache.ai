import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validateSharedReceiptEnvelope } from '../../src/contracts/shared-receipt.js';
import { redis } from '../../src/lib/redis.js';
import { sharedReceiptService } from '../../src/services/SharedReceiptService.js';
import { CortexRuntimeService } from '../../src/services/CortexRuntimeService.js';

function baseDeps(overrides: Record<string, any> = {}) {
  return {
    redisClient: redis,
    policy: {
      evaluate: vi.fn(async () => ({ allowed: true, score: 1 })),
    },
    trajectory: {
      inferSector: vi.fn(() => 'general'),
      predict: vi.fn(async () => ({
        sector: 'general',
        mode: 'goal_guided',
        anchorCount: 2,
        driftScore: 0.08,
        confidence: 0.91,
        expectedShift: 0.12,
        collapseRisk: 0.1,
      })),
    },
    queryMemoryFn: vi.fn(async () => [
      {
        id: 'mem_governance_1',
        score: 0.94,
        data: 'Prior governance rollouts worked best with policy, pilot, review, and telemetry stages.',
        metadata: { memoryPath: 'cortex/facts/governance-rollout' },
      },
    ]),
    upsertMemoryFn: vi.fn(async () => undefined),
    receiptService: sharedReceiptService,
    ...overrides,
  } as any;
}

describe('cortex runtime service', () => {
  beforeEach(async () => {
    const keys = await redis.keys('cortex:*');
    const receiptKeys = await redis.keys('shared_receipt:*');
    for (const key of [...keys, ...receiptKeys, 'shared_receipts:index']) {
      await redis.del(key);
    }
    vi.restoreAllMocks();
  });

  it('creates a persistent goal and a receipt-backed plan with memory and verification', async () => {
    const service = new CortexRuntimeService(baseDeps());

    const goal = await service.createGoal({
      objective: 'Create an intelligent governance agent for school districts.',
      constraints: ['No autonomous purchasing', 'Keep district data private'],
      successCriteria: ['Pilot plan is auditable'],
      preferredTools: ['policy.search'],
      orgId: 'org_test',
    }, { principalId: 'agent:test' });

    expect(goal.status).toBe('active');
    expect(goal.risk).toBe('low');

    const plan = await service.createPlan({
      goalId: goal.id,
      prompt: 'Plan the first safe rollout.',
      mode: 'advisory',
    }, { apiKey: 'ac_demo_test', principalId: 'agent:test' });

    expect(plan.status).toBe('ready');
    expect(plan.memory.semanticHits).toHaveLength(1);
    expect(plan.steps.map((step) => step.stage)).toContain('reflect');
    expect(plan.receiptId).toBe(`rcpt_${plan.id}`);

    const storedGoal = await service.getGoal(goal.id);
    expect(storedGoal?.lastPlanId).toBe(plan.id);

    const storedReceipt = await sharedReceiptService.get(plan.receiptId);
    expect(storedReceipt?.receipt.subject.kind).toBe('ORCHESTRATOR_RUN');
    expect(validateSharedReceiptEnvelope(storedReceipt?.receipt).success).toBe(true);
  });

  it('forces review for high-risk final actions and blocks ungated tool side effects', async () => {
    const service = new CortexRuntimeService(baseDeps({
      trajectory: {
        inferSector: vi.fn(() => 'finance'),
        predict: vi.fn(async () => ({
          sector: 'finance',
          anchorCount: 1,
          driftScore: 0.1,
          confidence: 0.8,
          expectedShift: 0.2,
          collapseRisk: 0.15,
        })),
      },
    }));

    const goal = await service.createGoal({
      objective: 'Publish a customer-facing finance memo.',
      sectorHint: 'finance',
      preferredTools: ['email.send'],
    });
    const plan = await service.createPlan({
      goalId: goal.id,
      tools: ['email.send'],
      finalAction: 'publish',
    });

    expect(plan.status).toBe('needs_review');
    expect(plan.verification.verdict).toBe('REVIEW');
    expect(plan.steps.find((step) => step.tool === 'email.send')?.requiresApproval).toBe(true);

    const blocked = await service.proposeToolRun({
      planId: plan.id,
      tool: 'email.send',
      input: { subject: 'Finance memo' },
    });
    expect(blocked.status).toBe('blocked');
    expect(blocked.blockedReason).toContain('approval');

    const simulated = await service.proposeToolRun({
      planId: plan.id,
      tool: 'email.send',
      mode: 'simulate',
    });
    expect(simulated.status).toBe('simulated');
    expect(simulated.result?.verifier).toBe('REVIEW');
  });

  it('reflects outcomes into episodes, beliefs, procedures, and failures', async () => {
    const upsertMemoryFn = vi.fn(async () => undefined);
    const service = new CortexRuntimeService(baseDeps({ upsertMemoryFn }));

    const goal = await service.createGoal({
      objective: 'Improve the Cortex rollout playbook.',
    });
    const plan = await service.createPlan({ goalId: goal.id });

    const reflected = await service.reflect({
      goalId: goal.id,
      planId: plan.id,
      outcome: 'partial',
      summary: 'The pilot worked, but legal review arrived late.',
      facts: ['Legal review must be scheduled before a district pilot begins.'],
      procedures: ['Use an approval checklist before any external rollout.'],
      failures: ['Late compliance review caused rollout delay.'],
    });

    expect(reflected.memories.map((memory) => memory.kind)).toEqual([
      'episode',
      'belief',
      'procedure',
      'failure',
    ]);
    expect(upsertMemoryFn).toHaveBeenCalledTimes(4);

    const search = await service.searchMemory({
      goalId: goal.id,
      query: 'approval checklist',
      kinds: ['procedure'],
    });
    expect(search.records).toHaveLength(1);
    expect(search.records[0].content).toContain('approval checklist');
  });

  it('runs a complete Cortex cycle with optional reflection', async () => {
    const service = new CortexRuntimeService(baseDeps());

    const cycle = await service.runCycle({
      objective: 'Design a customer support agent with durable memory.',
      prompt: 'Create the first operating plan.',
      tools: ['ticket.search'],
      reflection: {
        outcome: 'success',
        summary: 'The first cycle produced a useful support-agent operating plan.',
        procedures: ['Capture solved tickets as reusable support procedures.'],
        completeGoal: true,
      },
    });

    expect(cycle.plan.goalId).toBe(cycle.goal.id);
    expect(cycle.reflection?.goal.status).toBe('completed');
    expect(cycle.reflection?.memories.some((memory) => memory.kind === 'procedure')).toBe(true);
  });
});
