import { beforeAll, describe, expect, it, vi } from 'vitest';

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
  }, 20000);
});
