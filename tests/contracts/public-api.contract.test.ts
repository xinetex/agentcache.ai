import { beforeAll, describe, expect, it, vi } from 'vitest';
import { attachSharedReceiptSignature, buildSharedReceipt } from '../../src/contracts/shared-receipt.js';

vi.mock('../../src/services/ArmorService.js', () => ({
  ArmorService: class {
    async checkRequest() {
      return { allowed: true };
    }
  },
}));

vi.mock('../../src/api/clawsave.js', () => ({
  clawHealth: (c: any) => c.json({ ok: true }),
  clawAgent: (c: any) => c.json({ ok: true }),
  clawStorage: (c: any) => c.json({ ok: true }),
  clawProvision: (c: any) => c.json({ ok: true }),
  clawMemoryStore: (c: any) => c.json({ ok: true }),
  clawMemoryRecall: (c: any) => c.json({ ok: true }),
  clawMemoryForget: (c: any) => c.json({ ok: true }),
  clawMemoryShare: (c: any) => c.json({ ok: true }),
}));

vi.mock('../../src/lib/llm/embeddings.js', () => ({
  generateEmbedding: async () => new Array(1536).fill(0.1),
}));

vi.mock('../../src/lib/vector.js', () => ({
  upsertMemory: async () => {},
  queryMemory: async (query: string) => [
    { id: 'mock-id', score: 0.1, data: query, metadata: {} }
  ],
  vectorIndex: {
    fetch: async (ids: string[]) => ids.map(id => ({ 
      id, 
      data: 'mock-data', 
      metadata: {}, 
      vector: new Array(1536).fill(0.1) 
    })),
    upsert: async () => {},
    query: async (opts: any) => [
      { id: 'mock-id', score: 0.1, data: opts.data || '', metadata: {} }
    ],
    delete: async () => {},
  },
  HybridVectorIndex: class {
    constructor() {
      return {
        fetch: async (ids: string[]) => ids.map(id => ({ 
          id, 
          data: 'mock-data', 
          metadata: {}, 
          vector: new Array(1536).fill(0.1) 
        })),
        upsert: async () => {},
        query: async (opts: any) => [
          { id: 'mock-id', score: 0.1, data: opts.data || '', metadata: {} }
        ],
        delete: async () => {},
      };
    }
  }
}));

let app: any;

const apiKey = 'ac_demo_test123';

function unique(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function request(path: string, body?: Record<string, unknown>, method: string = 'POST') {
  const response = await app.request(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json();
  return { response, payload };
}

describe.sequential('AgentCache public API contracts', () => {
  beforeAll(async () => {
    ({ app } = await import('../../src/index.js'));
  });

  it('cache endpoints expose predictive prefetch on miss and hit flows', async () => {
    const previous = unique('cache-prev');
    const next = unique('cache-next');
    const cachedQuery = unique('cache-query');
    const requestBody = {
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.2,
      ttl: 120,
      semantic: false,
      messages: [{ role: 'user', content: cachedQuery }],
    };

    const trained = await request('/api/cache/check', {
      ...requestBody,
      messages: [{ role: 'user', content: next }],
      previous_query: previous,
    });
    expect(trained.response.status).toBe(200);

    const predicted = await request('/api/cache/check', {
      ...requestBody,
      messages: [{ role: 'user', content: previous }],
    });
    expect(predicted.payload.cached).toBe(false);
    expect(predicted.payload.predictive_prefetch[0]?.query).toBe(next);

    const miss = await request('/api/cache/get', {
      ...requestBody,
      messages: [{ role: 'user', content: previous }],
    });
    expect(miss.response.status).toBe(404);
    expect(miss.payload.hit).toBe(false);
    expect(Array.isArray(miss.payload.predictive_prefetch)).toBe(true);

    const stored = await request('/api/cache/set', {
      ...requestBody,
      response: 'cached-response',
    });
    expect(stored.response.status).toBe(200);

    const hit = await request('/api/cache/get', requestBody);
    expect(hit.response.status).toBe(200);
    expect(hit.payload.hit).toBe(true);
    expect(hit.payload.response).toBe('cached-response');
    expect(Array.isArray(hit.payload.predictive_prefetch)).toBe(true);
  }, 10000);

  it('exposes memory-fabric policy resolution and keeps sector-aware cache keys isolated', async () => {
    const sharedPrompt = unique('fabric-shared');
    const body = {
      provider: 'openai',
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: sharedPrompt }],
    };

    const profile = await request('/api/cache/fabric/profile', {
      sector: 'finance',
      verticalSku: 'finance-memory-fabric',
      ttl: 7200,
    });

    expect(profile.response.status).toBe(200);
    expect(profile.payload.success).toBe(true);
    expect(profile.payload.policy.verticalSku).toBe('finance-memory-fabric');
    expect(profile.payload.policy.sectorId).toBe('finance');
    expect(profile.payload.policy.effectiveTtlSeconds).toBe(300);
    expect(profile.payload.policy.evidenceMode).toBe('audit');

    const financeWrite = await request('/api/cache/set', {
      ...body,
      sector: 'finance',
      verticalSku: 'finance-memory-fabric',
      response: 'finance-cached-response',
      ttl: 7200,
    });

    expect(financeWrite.response.status).toBe(200);
    expect(financeWrite.payload.success).toBe(true);
    expect(financeWrite.payload.policy.sectorId).toBe('finance');
    expect(financeWrite.payload.policy.effectiveTtlSeconds).toBe(300);
    expect(financeWrite.payload.billing.creditsEstimated).toBeGreaterThan(0);

    const financeHit = await request('/api/cache/get', {
      ...body,
      sector: 'finance',
      verticalSku: 'finance-memory-fabric',
    });
    expect(financeHit.response.status).toBe(200);
    expect(financeHit.payload.hit).toBe(true);
    expect(financeHit.payload.response).toBe('finance-cached-response');
    expect(financeHit.payload.billing.creditsEstimated).toBeGreaterThan(0);

    const healthcareMiss = await request('/api/cache/get', {
      ...body,
      sector: 'healthcare',
      verticalSku: 'healthcare-memory-fabric',
    });
    expect(healthcareMiss.response.status).toBe(404);
    expect(healthcareMiss.payload.hit).toBe(false);
    expect(healthcareMiss.payload.policy.sectorId).toBe('healthcare');

    const roi = await request('/api/cache/fabric/roi', undefined, 'GET');
    expect(roi.response.status).toBe(200);
    expect(roi.payload.success).toBe(true);
    const financeAnalytics = roi.payload.analytics.bySku.find((item: any) => item.sku === 'finance-memory-fabric');
    expect(financeAnalytics).toBeDefined();
    expect(financeAnalytics.hits).toBeGreaterThanOrEqual(1);
    expect(financeAnalytics.ttlClampCount).toBeGreaterThanOrEqual(1);
    expect(financeAnalytics.estimatedUsdSaved).toBeGreaterThan(0);
    expect(roi.payload.accounting.totalCreditsEstimated).toBeGreaterThan(0);
    expect(roi.payload.accounting.bySku.some((item: any) => item.sku === 'finance-memory-fabric')).toBe(true);
  }, 10000);

  it('memory, cognitive, and stats endpoints return observable cognitive state', async () => {
    const memoryText = unique('memory-text');
    const previous = unique('memory-prev');
    const nodeId = unique('node');
    const fleetMemoryId = unique('fleet');

    const stored = await request('/api/memory/store', {
      content: memoryText,
      metadata: { query: memoryText, contract: true },
    });
    expect(stored.response.status).toBe(201);

    const recalled = await request('/api/memory/recall', {
      query: memoryText,
      previous_query: previous,
      limit: 3,
    });
    expect(recalled.response.status).toBe(200);
    expect(recalled.payload.success).toBe(true);
    expect(recalled.payload.results[0]?.content).toContain(memoryText);
    expect(Array.isArray(recalled.payload.predictive_prefetch)).toBe(true);

    const predict = await request('/api/cognitive/predict', {
      query: previous,
    });
    expect(predict.response.status).toBe(200);
    expect(predict.payload.predictions[0]?.query).toBe(memoryText);

    const drift = await request('/api/cognitive/drift', {
      id: stored.payload.id,
      heal: false,
    });
    expect(drift.response.status).toBe(200);
    expect(drift.payload.success).toBe(true);
    expect(typeof drift.payload.drift).toBe('number');
    expect(['healthy', 'decaying', 'dead']).toContain(drift.payload.status);

    const evolve = await request('/api/cognitive/evolve', {
      generations: 1,
      populationSize: 4,
    });
    expect(evolve.response.status).toBe(200);
    expect(evolve.payload.success).toBe(true);
    expect(evolve.payload.best.ttlSeconds).toBeGreaterThan(0);

    const fleet = await request('/api/cognitive/fleet/sync', {
      nodeId,
      memories: [
        {
          id: fleetMemoryId,
          updatedAt: new Date().toISOString(),
          confidence: 0.9,
        },
      ],
    });
    expect(fleet.response.status).toBe(200);
    expect(fleet.payload.success).toBe(true);
    expect(fleet.payload.merged).toBe(1);

    const status = await request('/api/cognitive/status', undefined, 'GET');
    expect(status.response.status).toBe(200);
    expect(status.payload.predictive_synapse.status).toBe('active');

    const stats = await request('/api/stats', undefined, 'GET');
    expect(stats.response.status).toBe(200);
    expect(stats.payload.cognitive.predictive_synapse.status).toBe('active');
    expect(typeof stats.payload.cognitive.metrics.hits).toBe('number');
    expect(stats.payload.fabric).toBeDefined();
    expect(typeof stats.payload.fabric.analytics.summary.totalOperations).toBe('number');
    expect(typeof stats.payload.fabric.accounting.totalCreditsEstimated).toBe('number');
  }, 20000);

  it('exposes joint objective sessions without colliding with legacy session history keys', async () => {
    const { redis } = await import('../../src/lib/redis.js');
    const { collectiveCortex } = await import('../../src/services/CollectiveCortex.js');

    await redis.set(`session:${unique('legacy')}:history`, JSON.stringify([{ event: 'history-only' }]));

    const session = await collectiveCortex.initiateSession(
      `Collective contract ${Date.now()}`,
      ['agent-finance', 'agent-legal']
    );

    const listed = await request('/api/observability/sessions', undefined, 'GET');
    expect(listed.response.status).toBe(200);
    expect(Array.isArray(listed.payload.sessions)).toBe(true);

    const stored = listed.payload.sessions.find((candidate: any) => candidate.id === session.id);
    expect(stored).toBeDefined();
    expect(stored.objective).toContain('Collective contract');
    expect(stored.participants).toEqual(['agent-finance', 'agent-legal']);
    expect(
      listed.payload.sessions.some((candidate: any) => typeof candidate.id === 'string' && candidate.id.includes(':history'))
    ).toBe(false);
  }, 10000);

  it('refuses badge issuance when auth cannot resolve a principal', async () => {
    const issued = await request('/api/molt/issue-badge');

    expect(issued.response.status).toBe(403);
    expect(issued.payload.error).toContain('authenticated principal');
  });

  it('ingests and exposes shared receipts through the public receipt API', async () => {
    process.env.SHARED_RECEIPT_SECRET = 'public-contract-receipt-secret';
    const receipt = attachSharedReceiptSignature(buildSharedReceipt({
      receiptId: unique('shared-receipt'),
      issuedAt: new Date().toISOString(),
      producer: {
        system: 'JETTYAGENT',
        id: 'maxxpoly',
        role: 'autopilot',
      },
      subject: {
        kind: 'BOT_CYCLE',
        id: unique('cycle'),
      },
      operation: {
        action: 'autopilot.tick',
        environment: 'prod',
      },
      ontology: {
        sectorId: 'finance',
        ontologyRef: 'finance@v1',
        confidence: 0.91,
      },
      economics: {
        sku: 'finance-memory-fabric',
        latencyMs: 1200,
      },
      trust: {
        verdict: 'INFO',
        confidence: 0.77,
      },
      telemetry: {
        cyclePnlUsd: 3.42,
      },
      refs: {
        marketId: 'kalshi:NBG1',
      },
    }), process.env.SHARED_RECEIPT_SECRET);

    const ingested = await request('/api/receipts/ingest', receipt);
    expect(ingested.response.status).toBe(201);
    expect(ingested.payload.success).toBe(true);
    expect(ingested.payload.signatureStatus).toBe('verified');

    const listed = await request('/api/receipts?producerSystem=JETTYAGENT&limit=10', undefined, 'GET');
    expect(listed.response.status).toBe(200);
    expect(listed.payload.success).toBe(true);
    expect(listed.payload.receipts.some((item: any) => item.receipt.receiptId === receipt.receiptId)).toBe(true);

    const fetched = await request(`/api/receipts/${receipt.receiptId}`, undefined, 'GET');
    expect(fetched.response.status).toBe(200);
    expect(fetched.payload.receipt.subject.kind).toBe('BOT_CYCLE');
    expect(fetched.payload.receipt.ontology.sectorId).toBe('finance');

    const summary = await request('/api/receipts/summary?producerSystem=JETTYAGENT', undefined, 'GET');
    expect(summary.response.status).toBe(200);
    expect(summary.payload.summary.total).toBeGreaterThanOrEqual(1);
    expect(summary.payload.summary.byProducerSystem[0].system).toBe('JETTYAGENT');

    const stats = await request('/api/stats', undefined, 'GET');
    expect(stats.response.status).toBe(200);
    expect(stats.payload.receipts.total).toBeGreaterThanOrEqual(1);
  }, 10000);

  it('runs a pathological assessment and records a hardening receipt', async () => {
    const profiles = await request('/api/pathological/profiles', undefined, 'GET');
    expect(profiles.response.status).toBe(200);
    expect(profiles.payload.success).toBe(true);
    expect(Array.isArray(profiles.payload.profiles)).toBe(true);
    expect(profiles.payload.profiles.length).toBeGreaterThan(0);

    const assessment = await request('/api/pathological/assess', {
      targetAgentId: unique('agent'),
      profileId: 'p1',
      sector: 'finance',
      severity: 'high',
      errorKind: 'stale_signal',
      provocation: {
        type: 'COGNITIVE',
        severity: 0.65,
        target: 'finance',
        durationMs: 25,
      },
    });

    expect(assessment.response.status).toBe(201);
    expect(assessment.payload.success).toBe(true);
    expect(assessment.payload.receipt.subject.kind).toBe('PATHOLOGY_RUN');
    expect(assessment.payload.receipt.operation.action).toBe('pathology.assess');
    expect(assessment.payload.receipt.ontology.sectorId).toBe('finance');
    expect(typeof assessment.payload.receipt.payload.duelForecast.success).toBe('boolean');
    expect(['PASS', 'REVIEW', 'BLOCK']).toContain(assessment.payload.receipt.trust.verdict);

    const run = await request(`/api/pathological/runs/${assessment.payload.receiptId}`, undefined, 'GET');
    expect(run.response.status).toBe(200);
    expect(run.payload.run.receipt.receiptId).toBe(assessment.payload.receiptId);
    expect(run.payload.run.receipt.subject.kind).toBe('PATHOLOGY_RUN');

    const summary = await request('/api/pathological/summary?sectorId=finance', undefined, 'GET');
    expect(summary.response.status).toBe(200);
    expect(summary.payload.success).toBe(true);
    expect(summary.payload.summary.total).toBeGreaterThanOrEqual(1);
    expect(summary.payload.summary.bySubjectKind.some((item: any) => item.kind === 'PATHOLOGY_RUN')).toBe(true);
  }, 10000);
});
