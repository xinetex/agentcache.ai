import { beforeAll, describe, expect, it, vi } from 'vitest';
import { attachSharedReceiptSignature, buildSharedReceipt } from '../../src/contracts/shared-receipt.js';

const mockVideoCacheGet = vi.fn(async (path: string) => {
  if (path === 'test/sample.mp4') return Buffer.from('video-data');
  return null;
});

const mockVideoCacheGetL1Stats = vi.fn(async () => ({ hits: 2, misses: 1 }));
const mockMemoryStore = new Map<string, { data: string; metadata: Record<string, any> }>();

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

vi.mock('../../transcoder-service/videocache.js', () => ({
  getVideoCache: () => ({
    get: mockVideoCacheGet,
    getL1Stats: mockVideoCacheGetL1Stats,
  }),
}));

vi.mock('../../src/services/transcode-queue.js', () => ({
  buildMediaPlan: (inputKey: string) => ({
    profile: { id: 'roku-hls', name: 'Roku HLS' },
    input: { key: inputKey, bucket: 'jettydata-prod', sourceFingerprint: 'test-fingerprint' },
    output: { prefix: 'transcoded/test', masterManifestKey: 'transcoded/test/master.m3u8', expectedRenditions: 4 },
    cache: { key: 'cache-test', lookupKey: 'transcodecache:v1:cache-test' },
    phases: [],
    validation: { rules: [] },
    provenance: { engine: 'agentcache-media-engine' },
  }),
  getTranscodeProfiles: () => [{ id: 'roku-hls', name: 'Roku HLS' }],
  submitMediaJob: async () => ({
    jobId: 'job-test-123',
    status: 'queued',
    cacheHit: false,
    plan: { profile: { id: 'roku-hls', name: 'Roku HLS' } },
  }),
  submitTranscodeJob: async () => 'job-test-123',
  getJobStatus: async (jobId: string) => ({
    status: 'queued',
    outputs: [],
    error: null,
    jobId,
  }),
  getRecentTranscodeJobs: async () => [],
  getQueueLength: async () => 3,
}));

vi.mock('../../src/services/edgeSelector.js', () => ({
  edgeSelector: {
    selectOptimalEdges: (
      _edges: any[],
      _metrics: any[],
      _location: { lat: number; lng: number },
      _priority: string,
      topN: number
    ) => Array.from({ length: topN }, (_, index) => ({
      edge: {
        id: `edge-${index + 1}`,
        url: `https://edge-${index + 1}.agentcache.test`,
        city: index === 0 ? 'Detroit' : `Edge ${index + 1}`,
        country: 'US',
        lat: 42.33,
        lng: -83.05,
        provider: 'agentcache',
      },
      distance: index * 10,
      score: 100 - index,
      weight: 1 - index * 0.1,
      latency: 25 + index,
      load: 0.2 + index * 0.05,
    })),
  },
}));

vi.mock('../../src/services/jettySpeedDb.js', () => ({
  jettySpeedDb: {
    getActiveEdges: async () => [
      { id: 'edge-1', url: 'https://edge-1.agentcache.test' },
      { id: 'edge-2', url: 'https://edge-2.agentcache.test' },
    ],
    getAllEdgeMetrics: async () => [
      { edgeId: 'edge-1', latencyMs: 25, load: 0.2 },
      { edgeId: 'edge-2', latencyMs: 30, load: 0.25 },
    ],
  },
}));

vi.mock('../../src/services/provisioning.js', () => ({
  generateApiKey: async ({ integration }: { integration: string }) => `ac_${integration}_mock_provisioned_key`,
  createNamespace: async ({ name }: { name: string }) => name,
  recordInstallation: async ({ user_id, project_id, namespace }: { user_id: string; project_id: string; namespace: string }) => ({
    id: 'installation-1',
    user_id,
    project_id,
    namespace,
  }),
  validateApiKey: async (key: string) => {
    if (key !== 'ac_valid_contract_key') {
      return null;
    }

    return {
      key,
      user_id: 'contract-user',
      integration: 'jettythunder',
      project_id: 'jettythunder-production',
      rate_limit: 10_000_000,
      usage_count: 7,
      created_at: new Date('2026-03-01T12:00:00.000Z'),
    };
  },
}));

vi.mock('../../src/lib/vector.js', () => ({
  upsertMemory: async (id: string, text: string, metadata: Record<string, any>) => {
    mockMemoryStore.set(id, { data: text, metadata });
  },
  queryMemory: async (query: string, _topK?: number, filter?: Record<string, any>) => {
    const entries = Array.from(mockMemoryStore.entries()).map(([id, record]) => ({
      id,
      score: 0.1,
      data: record.data,
      metadata: record.metadata,
    }));

    const filtered = entries.filter((entry) => {
      const contentMatch =
        String(entry.data || '').includes(query) ||
        String(entry.metadata?.query || '').includes(query);
      if (!contentMatch) return false;
      if (!filter) return true;
      return Object.entries(filter).every(([key, value]) => entry.metadata?.[key] === value);
    });

    return filtered.length > 0
      ? filtered
      : [{ id: 'mock-id', score: 0.1, data: query, metadata: filter || {} }];
  },
  vectorIndex: {
    fetch: async (ids: string[]) =>
      ids.map((id) => {
        const stored = mockMemoryStore.get(id);
        return {
          id,
          data: stored?.data || 'mock-data',
          metadata: stored?.metadata || {},
          vector: new Array(1536).fill(0.1),
        };
      }),
    upsert: async (record: any) => {
      const records = Array.isArray(record) ? record : [record];
      for (const item of records) {
        mockMemoryStore.set(item.id, {
          data: item.data || '',
          metadata: item.metadata || {},
        });
      }
    },
    query: async (opts: any) => [
      { id: 'mock-id', score: 0.1, data: opts.data || '', metadata: opts.filter || {} }
    ],
    delete: async () => {},
  },
  HybridVectorIndex: class {
    constructor() {
      return {
        fetch: async (ids: string[]) =>
          ids.map((id) => {
            const stored = mockMemoryStore.get(id);
            return {
              id,
              data: stored?.data || 'mock-data',
              metadata: stored?.metadata || {},
              vector: new Array(1536).fill(0.1),
            };
          }),
        upsert: async (record: any) => {
          const records = Array.isArray(record) ? record : [record];
          for (const item of records) {
            mockMemoryStore.set(item.id, {
              data: item.data || '',
              metadata: item.metadata || {},
            });
          }
        },
        query: async (opts: any) => [
          { id: 'mock-id', score: 0.1, data: opts.data || '', metadata: opts.filter || {} }
        ],
        delete: async () => {},
      };
    }
  }
}));

let app: any;

const apiKey = 'ac_demo_test123';
const adminToken = 'test-admin-token';

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

async function requestAdmin(path: string, body?: Record<string, unknown>, method: string = 'POST') {
  const response = await app.request(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Token': adminToken,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json();
  return { response, payload };
}

describe.sequential('AgentCache public API contracts', () => {
  beforeAll(async () => {
    process.env.ADMIN_TOKEN = adminToken;
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

  it('cache endpoints accept hosted, local, and tool provider identifiers', async () => {
    const geminiCheck = await request('/api/cache/check', {
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      messages: [{ role: 'user', content: unique('gemini-cache-provider') }],
      semantic: false,
    });
    expect(geminiCheck.response.status).toBe(200);

    const ollamaCheck = await request('/api/cache/check', {
      provider: 'ollama',
      model: 'gemma-local',
      messages: [{ role: 'user', content: unique('ollama-cache-provider') }],
      semantic: false,
    });
    expect(ollamaCheck.response.status).toBe(200);

    const toolCheck = await request('/api/cache/check', {
      provider: 'tool',
      model: 'weather',
      messages: [{ role: 'user', content: JSON.stringify({ city: 'Detroit' }) }],
      semantic: false,
    });
    expect(toolCheck.response.status).toBe(200);
  });

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

  it('publishes a focused revenue-core catalog for sellable AgentCache offers', async () => {
    const response = await app.request('/api/catalog/revenue-core', { method: 'GET' });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.recommendedLaunchWedge).toBe('Execution Drift Guard');
    expect(Array.isArray(payload.offers)).toBe(true);
    expect(payload.offers.some((offer: any) => offer.id === 'execution-drift-guard')).toBe(true);
    expect(payload.offers.some((offer: any) => offer.id === 'agentcache-core')).toBe(true);
    expect(payload.offers.some((offer: any) => offer.id === 'agent-storage-core')).toBe(true);
  });

  it('exposes outcome guidance that humans and agents can use to pick advanced services', async () => {
    const signals = await request('/api/advanced-services/signals', undefined, 'GET');

    expect(signals.response.status).toBe(200);
    expect(signals.payload.answer).toContain('signals are accessible now');
    expect(signals.payload.outcomes['monitor-drift'].guide.what).toContain('reliability lane');
    expect(signals.payload.outcomes['monitor-drift'].guide.agentContract.requiredInputs).toContain('workflow phases');
    expect(signals.payload.outcomes['govern-approvals'].guide.howToStart).toContain('context pack');
    expect(signals.payload.outcomes['ship-media-workflows'].guide.firstRequest).toEqual(
      expect.objectContaining({ method: 'POST', path: '/api/transcode/plan' }),
    );
  });

  it('scores and routes alignment requests with receipt-ready evidence', async () => {
    const scored = await request('/api/alignment/score', {
      sourceProvider: 'openai',
      targetProvider: 'anthropic',
      taskFamily: 'classification',
      privacyMode: 'encrypted_linear',
      sensitivity: 'regulated',
    });

    expect(scored.response.status).toBe(200);
    expect(scored.payload.report.compatible).toBe(true);
    expect(scored.payload.report.executionMode).toBe('encrypted_linear');

    const routed = await request('/api/alignment/route', {
      prompt: 'Classify this payment dispute by risk level.',
      taskFamily: 'classification',
      sectorHint: 'finance',
      sourceProvider: 'openai',
      sourceModel: 'text-embedding-3-small',
      allowedProviders: ['anthropic'],
      privacyMode: 'encrypted_linear',
      sensitivity: 'regulated',
      tierId: 'enterprise',
    });

    expect(routed.response.status).toBe(200);
    expect(routed.payload.decision.executionMode).toBe('encrypted_linear');
    expect(routed.payload.decision.receipt.subject.kind).toBe('ALIGNMENT_RUN');
    expect(routed.payload.decision.receipt.operation.sourceProvider).toBe('openai');
    expect(routed.payload.decision.receipt.operation.targetProvider).toBe('anthropic');
    expect(routed.payload.decision.policy.ontologyRef).toMatch(/^finance@/);
  });

  it('records alignment benchmarks and exposes alignment summaries through the app surface', async () => {
    const benchmark = await request('/api/alignment/benchmarks', {
      pairId: 'openai-anthropic-classification',
      sourceProvider: 'openai',
      sourceModel: 'text-embedding-3-small',
      targetProvider: 'anthropic',
      targetModel: 'claude-3-5-sonnet',
      taskFamily: 'classification',
      dataset: 'contract-fixture-v1',
      baselineScore: 0.93,
      alignedScore: 0.89,
      degradationPct: 4.3,
      latencyMs: 142,
      costUsd: 0.004,
      status: 'validated',
      notes: ['Recorded from contract test fixture'],
    });

    expect(benchmark.response.status).toBe(201);
    expect(benchmark.payload.benchmark.pairId).toBe('openai-anthropic-classification');

    const summary = await request('/api/alignment/summary', undefined, 'GET');
    expect(summary.response.status).toBe(200);
    expect(summary.payload.summary.storedBenchmarks).toBeGreaterThanOrEqual(1);
    expect(summary.payload.summary.validatedPairs).toBeGreaterThanOrEqual(1);

    const stats = await request('/api/observability/stats', undefined, 'GET');
    expect(stats.response.status).toBe(200);
    expect(stats.payload.alignment.storedBenchmarks).toBeGreaterThanOrEqual(1);
  });

  it('allows admin pair overrides and applies them to future alignment decisions', async () => {
    const created = await requestAdmin('/api/alignment/pairs', {
      id: 'openai-gemini-classification',
      sourceProvider: 'openai',
      targetProvider: 'gemini',
      taskFamily: 'classification',
      status: 'validated',
      compatibilityScore: 0.91,
      tokenizerCompatibility: 0.82,
      representationSimilarity: 0.88,
      privateInferenceCapable: true,
      evidenceLevel: 'validated-v1',
      notes: ['Contract-test operator approval'],
      updatedBy: 'contract-test',
    });

    expect(created.response.status).toBe(201);
    expect(created.payload.pair.status).toBe('validated');

    const patched = await requestAdmin('/api/alignment/pairs/openai-gemini-classification', {
      status: 'blocked',
      compatibilityScore: 0.22,
      privateInferenceCapable: false,
      notes: ['Blocked after regression'],
      updatedBy: 'contract-test',
    }, 'PATCH');

    expect(patched.response.status).toBe(200);
    expect(patched.payload.pair.status).toBe('blocked');

    const scored = await request('/api/alignment/score', {
      sourceProvider: 'openai',
      targetProvider: 'gemini',
      taskFamily: 'classification',
      privacyMode: 'encrypted_linear',
      sensitivity: 'regulated',
    });

    expect(scored.response.status).toBe(409);
    expect(scored.payload.report.compatible).toBe(false);

    const listed = await request('/api/alignment/pairs?includeBlocked=true', undefined, 'GET');
    const blockedPair = listed.payload.pairs.find((pair: any) => pair.id === 'openai-gemini-classification');
    expect(blockedPair?.status).toBe('blocked');
  });

  it('memory, cognitive, and stats endpoints return observable cognitive state', async () => {
    const memoryText = unique('memory-text');
    const previous = unique('memory-prev');
    const nodeId = unique('node');
    const fleetMemoryId = unique('fleet');
    const wing = unique('workspace');

    const stored = await request('/api/memory/store', {
      content: memoryText,
      metadata: { query: memoryText, contract: true, namespace: wing },
      structure: {
        wing,
        hall: 'facts',
        room: 'auth-decisions',
        layer: 'critical_facts',
      },
    });
    expect(stored.response.status).toBe(201);
    expect(stored.payload.structure.wing).toBe(wing);
    expect(stored.payload.structure.hall).toBe('facts');
    expect(stored.payload.structure.room).toBe('auth-decisions');
    expect(stored.payload.structure.layer).toBe('critical_facts');

    const recalled = await request('/api/memory/recall', {
      query: memoryText,
      previous_query: previous,
      limit: 3,
      structure: {
        wing,
        hall: 'facts',
      },
    });
    expect(recalled.response.status).toBe(200);
    expect(recalled.payload.success).toBe(true);
    expect(recalled.payload.results[0]?.content).toContain(memoryText);
    expect(recalled.payload.results[0]?.structure.wing).toBe(wing);
    expect(recalled.payload.structure_summary.byWing[wing]).toBeGreaterThan(0);
    expect(Array.isArray(recalled.payload.predictive_prefetch)).toBe(true);

    const fetched = await request(`/api/memory/${stored.payload.id}`, undefined, 'GET');
    expect(fetched.response.status).toBe(200);
    expect(fetched.payload.structure.path).toBe(`${wing}/facts/auth-decisions`);

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
    expect(stats.payload.externalAgents).toBeDefined();
    expect(typeof stats.payload.externalAgents.total).toBe('number');
  }, 20000);

  it('exposes an operator graph tying offers to receipts and drift posture', async () => {
    const operatorGraph = await request('/api/intelligence/operator-graph', undefined, 'GET');
    expect(operatorGraph.response.status).toBe(200);
    expect(Array.isArray(operatorGraph.payload.nodes)).toBe(true);
    expect(Array.isArray(operatorGraph.payload.links)).toBe(true);
    expect(operatorGraph.payload.nodes.some((node: any) => node.id === 'system:agentcache')).toBe(true);
    expect(operatorGraph.payload.nodes.some((node: any) => node.id === 'offer:execution-drift-guard')).toBe(true);
    expect(operatorGraph.payload.nodes.some((node: any) => node.id === 'signal:receipts')).toBe(true);
    expect(typeof operatorGraph.payload.stats.offers).toBe('number');
  });

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
        id: 'maxxeval.com',
        role: 'storage-runtime',
      },
      subject: {
        kind: 'STORAGE_TRANSFER',
        id: unique('storage-transfer'),
        route: '/api/jetty-speed/chunk',
      },
      operation: {
        action: 'storage.upload_file',
        provider: 'lyve',
        route: '/api/jetty-speed/chunk',
        method: 'PUT',
        environment: 'prod',
      },
      ontology: {
        sectorId: 'infrastructure',
        ontologyRef: 'storage@v1',
        confidence: 0.91,
      },
      economics: {
        sku: 'storage-evidence',
        latencyMs: 240,
      },
      trust: {
        verdict: 'PASS',
        confidence: 0.91,
      },
      telemetry: {
        bytesTransferred: 1048576,
      },
      refs: {
        direction: 'upload',
        namespace: 'tenant',
        tenantId: 9,
        userId: 42,
        objectKey: 'tenants/9/users/42/files/storage-proof.bin',
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
    expect(fetched.payload.receipt.subject.kind).toBe('STORAGE_TRANSFER');
    expect(fetched.payload.receipt.ontology.sectorId).toBe('infrastructure');

    const summary = await request('/api/receipts/summary?producerSystem=JETTYAGENT', undefined, 'GET');
    expect(summary.response.status).toBe(200);
    expect(summary.payload.summary.total).toBeGreaterThanOrEqual(1);
    expect(summary.payload.summary.byProducerSystem[0].system).toBe('JETTYAGENT');
    expect(summary.payload.summary.storage.transfers).toBeGreaterThanOrEqual(1);
    expect(summary.payload.summary.storage.byDirection).toEqual(
      expect.arrayContaining([{ direction: 'upload', count: 1 }]),
    );
    expect(summary.payload.summary.storage.byNamespace).toEqual(
      expect.arrayContaining([{ namespace: 'tenant', count: 1 }]),
    );
    expect(summary.payload.summary.storage.byTenantId).toEqual(
      expect.arrayContaining([{ tenantId: '9', count: 1 }]),
    );

    const stats = await request('/api/stats', undefined, 'GET');
    expect(stats.response.status).toBe(200);
    expect(stats.payload.receipts.total).toBeGreaterThanOrEqual(1);
    expect(stats.payload.browserProof).toBeDefined();
  }, 10000);

  it('summarizes MaxxEval commerce lifecycle receipts through the public receipt API', async () => {
    process.env.SHARED_RECEIPT_SECRET = 'public-contract-receipt-secret';
    const receipt = attachSharedReceiptSignature(buildSharedReceipt({
      receiptId: unique('commerce-receipt'),
      issuedAt: new Date().toISOString(),
      producer: {
        system: 'MAXXEVAL',
        id: 'maxxeval.com',
        role: 'trust-commerce-layer',
      },
      subject: {
        kind: 'API_CALL',
        id: unique('job-order'),
        route: '/api/job-orders/[id]',
      },
      operation: {
        action: 'FUND_ESCROW',
        provider: 'maxxeval',
        route: '/api/job-orders/[id]',
        method: 'PATCH',
        environment: 'prod',
      },
      ontology: {
        sectorId: 'finance',
        ontologyRef: 'finance@v1',
        confidence: 0.89,
      },
      trust: {
        verdict: 'PASS',
        confidence: 0.95,
      },
      refs: {
        buyerId: 'buyer-contract',
        sellerAgentProfileId: 'seller-contract',
        escrowStatus: 'HELD',
      },
    }), process.env.SHARED_RECEIPT_SECRET);

    const ingested = await request('/api/receipts/ingest', receipt);
    expect(ingested.response.status).toBe(201);

    const summary = await request('/api/receipts/summary?producerSystem=MAXXEVAL', undefined, 'GET');
    expect(summary.response.status).toBe(200);
    expect(summary.payload.summary.commerce.lifecycleEvents).toBeGreaterThanOrEqual(1);
    expect(summary.payload.summary.commerce.byAction).toEqual(
      expect.arrayContaining([{ action: 'FUND_ESCROW', count: 1 }]),
    );
    expect(summary.payload.summary.commerce.byEscrowStatus).toEqual(
      expect.arrayContaining([{ status: 'HELD', count: 1 }]),
    );
    expect(summary.payload.summary.commerce.byBuyerId).toEqual(
      expect.arrayContaining([{ buyerId: 'buyer-contract', count: 1 }]),
    );
    expect(summary.payload.summary.commerce.bySellerAgentProfileId).toEqual(
      expect.arrayContaining([{ sellerAgentProfileId: 'seller-contract', count: 1 }]),
    );
  }, 10000);

  it('summarizes browser-proof receipts by execution mode and engine quality', async () => {
    process.env.SHARED_RECEIPT_SECRET = 'public-contract-receipt-secret';
    const receipt = attachSharedReceiptSignature(buildSharedReceipt({
      receiptId: unique('browser-proof-receipt'),
      issuedAt: new Date().toISOString(),
      producer: {
        system: 'MAXXEVAL',
        id: 'maxxeval.com',
        role: 'trust-commerce-layer',
      },
      subject: {
        kind: 'BROWSER_TASK',
        id: unique('browser-task'),
        route: '/api/x402/v1/agentcache/browser/proof',
      },
      operation: {
        action: 'CAPTURE_BROWSER_PROOF',
        provider: 'agentcache',
        route: '/api/x402/v1/agentcache/browser/proof',
        method: 'GET',
        environment: 'prod',
      },
      ontology: {
        sectorId: 'finance',
        ontologyRef: 'finance@v1',
        confidence: 0.93,
      },
      trust: {
        verdict: 'PASS',
        confidence: 0.95,
        status: 'stable',
      },
      payload: {
        executionMode: 'lightpanda+firecrawl+http',
        engine: 'lightpanda',
      },
    }), process.env.SHARED_RECEIPT_SECRET);

    const ingested = await request('/api/receipts/ingest', receipt);
    expect(ingested.response.status).toBe(201);

    const summary = await request('/api/receipts/summary?producerSystem=MAXXEVAL', undefined, 'GET');
    expect(summary.response.status).toBe(200);
    expect(summary.payload.summary.browser.proofs).toBeGreaterThanOrEqual(1);
    expect(summary.payload.summary.browser.byExecutionMode).toEqual(
      expect.arrayContaining([{ executionMode: 'lightpanda+firecrawl+http', count: 1 }]),
    );
    expect(summary.payload.summary.browser.byEngine).toEqual(
      expect.arrayContaining([{ engine: 'lightpanda', count: 1 }]),
    );
    expect(summary.payload.summary.browser.byHomeostasisStatus).toEqual(
      expect.arrayContaining([{ status: 'stable', count: 1 }]),
    );

    const stats = await request('/api/stats', undefined, 'GET');
    expect(stats.response.status).toBe(200);
    expect(stats.payload.browserProof.proofs).toBeGreaterThanOrEqual(1);
    expect(stats.payload.browserProof.byEngine).toEqual(
      expect.arrayContaining([{ engine: 'lightpanda', count: 1 }]),
    );
  }, 10000);

  it('registers an external agent and records a Soulprint scan receipt', async () => {
    const registration = await request('/api/external-agents/register', {
      externalSystem: 'moltbook',
      externalAgentId: unique('moltbot'),
      displayName: 'Moltbook Research Bot',
      profileUrl: 'https://moltbook.com/bots/research-bot',
      metadata: {
        vertical: 'finance',
      },
    });

    expect(registration.response.status).toBe(201);
    expect(registration.payload.success).toBe(true);
    expect(registration.payload.registration.status).toBe('pending');
    expect(typeof registration.payload.registration.challengeToken).toBe('string');

    const verified = await request(`/api/external-agents/${registration.payload.registration.id}/verify`, {
      ownershipProof: registration.payload.registration.challengeToken,
    });
    expect(verified.response.status).toBe(200);
    expect(verified.payload.registration.status).toBe('verified');

    const soulprint = await request(`/api/external-agents/${registration.payload.registration.id}/soulprint`, {
      sector: 'finance',
      confidence: 0.91,
      summary: 'Risk-sensitive bot with strong escalation instincts.',
      sources: [
        {
          kind: 'prompt-template',
          ref: 'moltbook://bot/research-bot/system-prompt',
          excerpt: 'Escalate when confidence drops below 0.7.',
        },
      ],
      findings: [
        {
          category: 'escalation',
          summary: 'Escalates aggressively under low-confidence states.',
          severity: 'medium',
        },
      ],
      biasFlags: ['recency_bias', 'authority_bias'],
      topology: {
        escalationBias: 0.81,
        authorityBias: 0.72,
      },
    });

    expect(soulprint.response.status).toBe(201);
    expect(soulprint.payload.success).toBe(true);
    expect(soulprint.payload.receipt.subject.kind).toBe('SOULPRINT_SCAN');
    expect(soulprint.payload.receipt.refs.registrationId).toBe(registration.payload.registration.id);

    const listed = await request('/api/external-agents', undefined, 'GET');
    expect(listed.response.status).toBe(200);
    expect(listed.payload.registrations.some((item: any) => item.id === registration.payload.registration.id)).toBe(true);

    const receipt = await request(`/api/receipts/${soulprint.payload.receiptId}`, undefined, 'GET');
    expect(receipt.response.status).toBe(200);
    expect(receipt.payload.receipt.subject.kind).toBe('SOULPRINT_SCAN');
  }, 10000);

  it('can derive a Soulprint from uploaded config artifacts', async () => {
    const registration = await request('/api/external-agents/register', {
      externalSystem: 'generic',
      externalAgentId: unique('external-bot'),
      displayName: 'External Finance Bot',
    });

    expect(registration.response.status).toBe(201);

    const verified = await request(`/api/external-agents/${registration.payload.registration.id}/verify`, {
      ownershipProof: registration.payload.registration.challengeToken,
    });
    expect(verified.response.status).toBe(200);

    const soulprint = await request(`/api/external-agents/${registration.payload.registration.id}/soulprint`, {
      artifacts: [
        {
          kind: 'system-prompt',
          ref: 'file://SOUL.md',
          content: 'Always escalate to human review for policy breaches. Use the latest market information and approved sources only.',
        },
        {
          kind: 'skill',
          ref: 'file://SKILL.md',
          content: 'Brainstorm multiple approaches for Kalshi market analysis and risk decisions.',
        },
      ],
    });

    expect(soulprint.response.status).toBe(201);
    expect(soulprint.payload.soulprint.sector).toBe('finance');
    expect(soulprint.payload.soulprint.biasFlags).toEqual(
      expect.arrayContaining(['escalation_bias', 'recency_bias', 'authority_bias', 'exploration_bias']),
    );
    expect(soulprint.payload.receipt.subject.kind).toBe('SOULPRINT_SCAN');
  }, 10000);

  it('summarizes external agents and exposes Soulprint reports', async () => {
    const registration = await request('/api/external-agents/register', {
      externalSystem: 'moltbook',
      externalAgentId: unique('summary-agent'),
      displayName: 'Summary Agent',
    });

    expect(registration.response.status).toBe(201);

    const verified = await request(`/api/external-agents/${registration.payload.registration.id}/verify`, {
      ownershipProof: registration.payload.registration.challengeToken,
    });
    expect(verified.response.status).toBe(200);

    const soulprint = await request(`/api/external-agents/${registration.payload.registration.id}/soulprint`, {
      artifacts: [
        {
          kind: 'system-prompt',
          ref: 'moltbook://bot/summary-agent/system-prompt',
          content: 'Use the latest market risk data and escalate to human review for uncertain Kalshi trading moves.',
        },
      ],
    });

    expect(soulprint.response.status).toBe(201);

    const summary = await request('/api/external-agents/summary', undefined, 'GET');
    expect(summary.response.status).toBe(200);
    expect(summary.payload.success).toBe(true);
    expect(summary.payload.summary.total).toBeGreaterThanOrEqual(1);
    expect(summary.payload.summary.verified).toBeGreaterThanOrEqual(1);
    expect(summary.payload.summary.withSoulprint).toBeGreaterThanOrEqual(1);
    expect(summary.payload.summary.bySystem).toEqual(
      expect.arrayContaining([expect.objectContaining({ system: 'moltbook' })]),
    );
    expect(summary.payload.summary.bySector).toEqual(
      expect.arrayContaining([expect.objectContaining({ sector: 'finance' })]),
    );
    expect(summary.payload.summary.byBiasFlag).toEqual(
      expect.arrayContaining([expect.objectContaining({ biasFlag: 'escalation_bias' })]),
    );

    const stats = await request('/api/stats', undefined, 'GET');
    expect(stats.response.status).toBe(200);
    expect(stats.payload.externalAgents.total).toBeGreaterThanOrEqual(1);
    expect(stats.payload.externalAgents.withSoulprint).toBeGreaterThanOrEqual(1);

    const report = await request(
      `/api/external-agents/${registration.payload.registration.id}/soulprint/report`,
      undefined,
      'GET',
    );
    expect(report.response.status).toBe(200);
    expect(report.payload.success).toBe(true);
    expect(report.payload.registration.id).toBe(registration.payload.registration.id);
    expect(report.payload.soulprint.sector).toBe('finance');
    expect(report.payload.soulprint.findings.length).toBeGreaterThan(0);
    expect(report.payload.receipt.subject.kind).toBe('SOULPRINT_SCAN');

    const observability = await app.request('/api/observability/stats');
    expect(observability.status).toBe(200);
    const observabilityPayload = await observability.json();
    expect(observabilityPayload.externalAgents.total).toBeGreaterThanOrEqual(1);
    expect(observabilityPayload.externalAgents.bySector).toEqual(
      expect.arrayContaining([expect.objectContaining({ sector: 'finance' })]),
    );
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

  it('exposes local audio1.tv and JettyThunder route contracts through the app surface', async () => {
    mockVideoCacheGet.mockClear();
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      if (url === 'http://localhost:3000/api/admin/goap/execute') {
        return new Response(JSON.stringify({ success: true, planned: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === 'https://lyve-upload.example/chunk') {
        return new Response(null, {
          status: 200,
          headers: { ETag: '"lyve-etag-123"' },
        });
      }

      if (url === 'https://lyve-download.example/chunk') {
        return new Response('lyve-chunk-data', {
          status: 200,
          headers: { 'Content-Type': 'application/octet-stream' },
        });
      }

      return originalFetch(input as any, init);
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      const cdnMissingParams = await request('/api/cdn/stream', undefined, 'GET');
      expect(cdnMissingParams.response.status).toBe(400);
      expect(cdnMissingParams.payload.error).toContain('Missing path');

      const cdnFoundResponse = await app.request('/api/cdn/stream?path=test/sample.mp4', {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
        },
      });
      expect(cdnFoundResponse.status).toBe(200);
      expect(cdnFoundResponse.headers.get('X-VideoCache')).toBe('HIT');
      expect(await cdnFoundResponse.text()).toBe('video-data');

      const cdnStatus = await request('/api/cdn/status', undefined, 'GET');
      expect(cdnStatus.response.status).toBe(200);
      expect(cdnStatus.payload.component).toBe('cdn');
      expect(cdnStatus.payload.cache.enabled).toBe(true);
      expect(cdnStatus.response.headers.get('X-Customer-Id')).toBe('audio1_tv');
      expect(cdnStatus.response.headers.get('X-Service-Category')).toBe('cdn_streaming');

      const cdnWarm = await request('/api/cdn/warm', {
        paths: ['test/sample.mp4', 'test/missing-preview.jpg'],
      }, 'POST');
      expect(cdnWarm.response.status).toBe(200);
      expect(cdnWarm.payload.success).toBe(true);
      expect(cdnWarm.payload.warmed).toEqual(['test/sample.mp4']);
      expect(cdnWarm.payload.skipped).toHaveLength(1);
      expect(cdnWarm.payload.skipped[0].path).toBe('test/missing-preview.jpg');
      expect(cdnWarm.response.headers.get('X-Customer-Id')).toBe('audio1_tv');
      expect(cdnWarm.response.headers.get('X-Service-Category')).toBe('cdn_streaming');
      expect(mockVideoCacheGet).toHaveBeenCalledWith('test/sample.mp4');
      expect(mockVideoCacheGet).toHaveBeenCalledWith('test/missing-preview.jpg');

      const transcodeReject = await request('/api/transcode/submit', {}, 'POST');
      expect(transcodeReject.response.status).toBe(400);
      expect(transcodeReject.payload.error).toContain('inputKey');

      const transcodeSubmit = await request('/api/transcode/submit', {
        inputKey: 'test/source-video.mp4',
        profile: 'roku-hls',
      }, 'POST');
      expect(transcodeSubmit.response.status).toBe(200);
      expect(transcodeSubmit.payload.jobId).toBe('job-test-123');
      expect(transcodeSubmit.payload.status).toBe('queued');
      expect(transcodeSubmit.response.headers.get('X-Customer-Id')).toBe('audio1_tv');
      expect(transcodeSubmit.response.headers.get('X-Service-Category')).toBe('transcoding');

      const transcodeStatus = await request('/api/transcode/status/test-job-123', undefined, 'GET');
      expect(transcodeStatus.response.status).toBe(200);
      expect(transcodeStatus.payload.jobId).toBe('test-job-123');
      expect(transcodeStatus.payload.status).toBe('queued');

      const transcodeJobs = await request('/api/transcode/jobs', undefined, 'GET');
      expect(transcodeJobs.response.status).toBe(200);
      expect(transcodeJobs.payload.queueLength).toBe(3);

      const transcodeCancel = await request('/api/transcode/cancel/test-job-123', {}, 'POST');
      expect(transcodeCancel.response.status).toBe(501);
      expect(transcodeCancel.payload.success).toBe(false);
      expect(transcodeCancel.payload.message).toContain('not yet implemented');

      const provision = await request('/api/provision/jettythunder', {}, 'POST');
      expect(provision.response.status).toBe(201);
      expect(provision.payload.success).toBe(true);
      expect(provision.payload.api_key).toMatch(/^ac_/);
      expect(provision.payload.namespace).toBe('jettythunder_production');
      expect(provision.payload.environment).toBe('production');
      expect(provision.payload.integration_guide.env_vars.AGENTCACHE_API_KEY).toMatch(/^ac_/);
      expect(provision.payload.tier).toBe('enterprise');
      expect(provision.response.headers.get('X-Customer-Id')).toBe('jettythunder_app');
      expect(provision.response.headers.get('X-Service-Category')).toBe('file_provisioning');

      const edgeSelection = await request('/api/edges/optimal', {
        lat: 42.3314,
        lng: -83.0458,
        fileSize: 1024,
        priority: 'speed',
        topN: 2,
      }, 'POST');
      expect(edgeSelection.response.status).toBe(200);
      expect(edgeSelection.payload.edges).toHaveLength(2);
      expect(edgeSelection.payload.edges[0].edge.url).toContain('edge-1.agentcache.test');
      expect(edgeSelection.response.headers.get('X-Customer-Id')).toBe('jettythunder_app');
      expect(edgeSelection.response.headers.get('X-Service-Category')).toBe('edge_routing');

      const edgeMissingLatLng = await request('/api/edges/optimal', { fileSize: 1024 }, 'POST');
      expect(edgeMissingLatLng.response.status).toBe(400);
      expect(edgeMissingLatLng.payload.error).toContain('Missing lat/lng');

      const chunkUpload = await app.request('/api/jetty-speed/chunk', {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
          'X-File-Id': 'file-123',
          'X-Chunk-Index': '0',
          'X-Lyve-Upload-Url': 'https://lyve-upload.example/chunk',
          'X-Edge-Id': 'edge-1',
          'Content-Type': 'application/octet-stream',
        },
        body: 'chunk-data',
      });
      expect(chunkUpload.status).toBe(200);
      expect(chunkUpload.headers.get('X-Customer-Id')).toBe('jettythunder_app');
      expect(chunkUpload.headers.get('X-Service-Category')).toBe('chunk_caching');
      const chunkUploadPayload = await chunkUpload.json();
      expect(chunkUploadPayload.success).toBe(true);
      expect(chunkUploadPayload.edgeId).toBe('edge-1');
      expect(chunkUploadPayload.etag).toBe('"lyve-etag-123"');

      const chunkCacheHit = await app.request('/api/jetty-speed/chunk/file-123/0', {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
        },
      });
      expect(chunkCacheHit.status).toBe(200);
      expect(chunkCacheHit.headers.get('X-Cache')).toBe('HIT');
      expect(await chunkCacheHit.text()).toBe('chunk-data');

      const chunkCacheMissFetch = await app.request('/api/jetty-speed/chunk/file-456/0', {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
          'X-Lyve-Download-Url': 'https://lyve-download.example/chunk',
        },
      });
      expect(chunkCacheMissFetch.status).toBe(200);
      expect(chunkCacheMissFetch.headers.get('X-Cache')).toBe('MISS');
      expect(await chunkCacheMissFetch.text()).toBe('lyve-chunk-data');

      const chunkCacheMissNoUrl = await request('/api/jetty-speed/chunk/file-789/0', undefined, 'GET');
      expect(chunkCacheMissNoUrl.response.status).toBe(404);
      expect(chunkCacheMissNoUrl.payload.error).toContain('not found');

      const stagingProvision = await request('/api/provision/jettythunder', {
        environment: 'staging',
      }, 'POST');
      expect(stagingProvision.response.status).toBe(201);
      expect(stagingProvision.payload.namespace).toBe('jettythunder_staging');
      expect(stagingProvision.payload.environment).toBe('staging');

      const musclePlan = await request('/api/muscle/plan', {
        goal: 'test-connection',
      }, 'POST');
      expect([200, 502]).toContain(musclePlan.response.status);
      expect(musclePlan.response.headers.get('X-Customer-Id')).toBe('jettythunder_app');
      expect(musclePlan.response.headers.get('X-Service-Category')).toBe('ai_processing');
      if (musclePlan.response.status === 502) {
        expect(musclePlan.payload.error).toContain('Muscle');
      }

      const invalidProvisionKey = await request('/api/provision/ac_invalid_contract_key', undefined, 'GET');
      expect(invalidProvisionKey.response.status).toBe(404);
      expect(invalidProvisionKey.payload.error).toContain('not found');

      const validProvisionKey = await request('/api/provision/ac_valid_contract_key', undefined, 'GET');
      expect(validProvisionKey.response.status).toBe(200);
      expect(validProvisionKey.payload.success).toBe(true);
      expect(validProvisionKey.payload.key_info.user_id).toBe('contract-user');
      expect(validProvisionKey.payload.key_info.integration).toBe('jettythunder');
      expect(validProvisionKey.payload.key_info.key_preview).toContain('...');
      expect(validProvisionKey.payload.key_info.key_preview).not.toBe('ac_valid_contract_key');
    } finally {
      vi.stubGlobal('fetch', originalFetch);
    }
  }, 10000);

  it('runs execution control workflows through review and gate approval', async () => {
    const created = await request('/api/execution/context-packs', {
      name: unique('execution-pack'),
      objective: 'Review a finance memo before it is published externally.',
      methodology: 'Route through policy review and require approval.',
      conventions: ['Use exact figures only'],
      tools: ['retrieval', 'policy-check'],
      workflowPhases: ['draft', 'review', 'gate', 'finalize'],
      reviewerRoles: ['critical', 'compliance'],
      policyProfile: {
        verticalSku: 'finance-memory-fabric',
      },
      sectorHint: 'finance',
      sources: [
        {
          kind: 'policy',
          uri: 'ac://policies/finance/release',
          title: 'Finance release policy',
        },
      ],
    });

    expect(created.response.status).toBe(201);
    expect(created.payload.pack.latestVersion).toBe(1);
    expect(created.payload.version.policy.evidenceMode).toBe('audit');
    expect(created.payload.version.reviewerRoles).toEqual(['critical', 'compliance']);

    const started = await request('/api/execution/runs', {
      contextPackId: created.payload.pack.id,
      inputPayload: {
        documentId: unique('doc'),
      },
      finalAction: 'publish',
    });

    expect(started.response.status).toBe(201);
    expect(started.payload.run.currentPhase).toBe('draft');
    expect(started.payload.run.status).toBe('in_progress');
    expect(started.payload.run.gateStatus).toBe('pending');
    expect(started.payload.gate.status).toBe('pending');

    const advanced = await request(`/api/execution/runs/${started.payload.run.id}/phase`, {
      phase: 'review',
    });

    expect(advanced.response.status).toBe(200);
    expect(advanced.payload.run.currentPhase).toBe('review');
    expect(advanced.payload.run.status).toBe('awaiting_review');

    const criticalReviewed = await request(`/api/execution/runs/${started.payload.run.id}/reviews`, {
      reviewerRole: 'critical',
      verdict: 'PASS',
      summary: 'No blocking issues found.',
      findings: ['Receipts and citations present.'],
      confidence: 0.93,
    });

    expect(criticalReviewed.response.status).toBe(201);
    expect(criticalReviewed.payload.run.status).toBe('awaiting_review');
    expect(criticalReviewed.payload.run.completedReviewerRoles).toEqual(['critical']);

    const reviewed = await request(`/api/execution/runs/${started.payload.run.id}/reviews`, {
      reviewerRole: 'compliance',
      verdict: 'PASS',
      summary: 'Policy controls satisfied.',
      findings: ['No disclosure issues detected.'],
      confidence: 0.95,
    });

    expect(reviewed.response.status).toBe(201);
    expect(reviewed.payload.run.status).toBe('awaiting_gate');
    expect(reviewed.payload.run.currentPhase).toBe('gate');

    const approved = await requestAdmin(`/api/execution/gates/${started.payload.gate.id}/approve`, {
      note: 'Approved for release.',
      decidedBy: 'contract-admin',
    });

    expect(approved.response.status).toBe(200);
    expect(approved.payload.run.status).toBe('completed');
    expect(approved.payload.gate.status).toBe('approved');

    const fetched = await request(`/api/execution/runs/${started.payload.run.id}`, undefined, 'GET');
    expect(fetched.response.status).toBe(200);
    expect(fetched.payload.reviews).toHaveLength(2);
    expect(fetched.payload.gate.status).toBe('approved');

    const recommendations = await request(
      `/api/execution/runs/${started.payload.run.id}/recommendations`,
      undefined,
      'GET'
    );
    expect(recommendations.response.status).toBe(200);
    expect(recommendations.payload.report.runId).toBe(started.payload.run.id);
    expect(Array.isArray(recommendations.payload.report.recommendations)).toBe(true);
  });
});
