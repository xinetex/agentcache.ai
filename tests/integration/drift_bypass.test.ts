import { beforeAll, describe, expect, it, vi } from 'vitest';

// Mock drift assessment to trigger bypass
vi.mock('../../src/services/cognitive-memory.js', () => ({
  cognitiveMemory: {
    observeTransition: async () => {},
    predictNext: async () => [],
    recordCacheOutcome: async () => {},
    assessDrift: vi.fn(async (id: string) => {
        return { drift: 0.01, status: 'healthy', healed: false };
    })
  }
}));

vi.mock('../../src/services/ObservabilityService.js', () => ({
  observabilityService: {
    track: vi.fn(async () => {})
  }
}));

// Mock embeddings and vector to avoid real API calls
vi.mock('../../src/lib/llm/embeddings.js', () => ({
  generateEmbedding: async () => new Array(1536).fill(0.1),
}));

vi.mock('../../src/lib/vector.js', () => ({
  upsertMemory: async () => {},
  queryMemory: async () => [],
  HybridVectorIndex: class { constructor() { return {}; } }
}));

let app: any;
const apiKey = 'ac_demo_test123';

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
  console.log(`[Test Request] ${method} ${path} -> Status: ${response.status}, Payload:`, JSON.stringify(payload));
  return { response, payload };
}

describe('Drift-Aware Cache Bypass Integration', () => {
  beforeAll(async () => {
    ({ app } = await import('../../src/index.js'));
    // Need to clear mocks to track observability calls
    const { observabilityService } = await import('../../src/services/ObservabilityService.js');
    (observabilityService.track as any).mockClear();
  });

  it('should bypass cache hit when drift is high (> 0.15)', async () => {
    const highDriftQuery = 'high-drift-query';
    const messages = [{ role: 'user', content: highDriftQuery }];
    const sessionId = 'test-session-123';
    
    // 0. Mock high drift for the next assessDrift call
    const { cognitiveMemory } = await import('../../src/services/cognitive-memory.js');
    (cognitiveMemory.assessDrift as any).mockResolvedValueOnce({ 
        drift: 0.8, 
        status: 'dead', 
        healed: false 
    });

    // 1. Set the cache first
    await request('/api/cache/set', {
      messages,
      response: 'this should be bypassed',
      model: 'gpt-4o',
      sessionId,
      turnIndex: 1
    });

    // 2. Check the cache - should be a MISS due to drift_bypass
    // Note: assessDrift will return high drift for this check
    const { payload } = await request('/api/cache/check', {
      messages,
      model: 'gpt-4o',
      sessionId,
      turnIndex: 2
    });

    expect(payload.hit).toBe(false);
    expect(payload.reason).toBe('drift_bypass');
    expect(payload.drift).toBeGreaterThan(0.15);
    expect(payload.sessionId).toBe(sessionId);
    expect(payload.turnIndex).toBe(2);

    // 3. Verify Observability Tracked the Bypass
    const { observabilityService } = await import('../../src/services/ObservabilityService.js');
    expect(observabilityService.track).toHaveBeenCalledWith(expect.objectContaining({
        type: 'CACHE_OPERATION',
        description: expect.stringContaining('Cache MISS: DRIFT BYPASS'),
        metadata: expect.objectContaining({
            sessionId,
            reason: 'drift_bypass'
        })
    }));
  });

  it('should allow cache hit when drift is low (<= 0.15)', async () => {
    const lowDriftQuery = 'low-drift-query';
    const messages = [{ role: 'user', content: lowDriftQuery }];
    
    // 1. Set the cache
    await request('/api/cache/set', {
      messages,
      response: 'stable-response',
      model: 'gpt-4o'
    });

    // 2. Check the cache - should be a HIT
    const { payload } = await request('/api/cache/check', {
      messages,
      model: 'gpt-4o'
    });

    expect(payload.hit).toBe(true);
    expect(payload.reason).toBe('exact');
    expect(payload.drift).toBeLessThanOrEqual(0.15);
  });
});
