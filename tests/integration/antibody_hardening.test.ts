import { describe, it, expect, vi, beforeEach } from 'vitest';
import { semanticCacheService } from '../../src/services/SemanticCacheService.js';
import { cognitiveMemory } from '../../src/services/cognitive-memory.js';
import { pathologySandbox } from '../../src/services/PathologySandbox.js';
import { eventBus } from '../../src/lib/event-bus.js';
import { redis } from '../../src/lib/redis.js';

vi.mock('../../src/lib/redis.js', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    hgetall: vi.fn(),
    hincrby: vi.fn(),
    setex: vi.fn(),
    incr: vi.fn(),
    incrbyfloat: vi.fn(),
    publish: vi.fn(),
    lpush: vi.fn(),
    ltrim: vi.fn()
  }
}));

vi.mock('../../src/services/cognitive-memory.js', () => ({
  cognitiveMemory: {
    assessDrift: vi.fn(),
    observeTransition: vi.fn().mockResolvedValue(undefined),
    predictNext: vi.fn().mockResolvedValue([]),
    recordCacheOutcome: vi.fn().mockResolvedValue(undefined)
  }
}));

describe('Antibody Hardening & Pathology Sandbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use a stricter threshold after receiving an antibody pulse', async () => {
    // 1. Setup: Cached response exists, drift is 0.1 (below 0.15 default, but above 0.05 hardened)
    vi.mocked(redis.get).mockResolvedValue('Cached Response');
    vi.mocked(cognitiveMemory.assessDrift).mockResolvedValue({ 
        drift: 0.1, 
        status: 'decaying',
        healed: false
    });

    // 2. Normal check should be a HIT
    const res1 = await semanticCacheService.check({
      messages: [{ role: 'user', content: 'test' }],
      model: 'gpt-4',
      sessionId: 'session-A'
    });
    expect(res1.hit).toBe(true);

    // 3. Emit antibody pulse for session-A
    eventBus.publish('antibody_pulse', { sessionId: 'session-A' }, 'test');

    // 4. Hardened check should be a MISS (Drift Bypass)
    const res2 = await semanticCacheService.check({
      messages: [{ role: 'user', content: 'test' }],
      model: 'gpt-4',
      sessionId: 'session-A'
    });
    expect(res2.hit).toBe(false);
    expect(res2.reason).toBe('drift_bypass');
  });

  it('should successfully start a logic duel in the sandbox', async () => {
    const publishSpy = vi.spyOn(eventBus, 'publish');
    const duelId = await pathologySandbox.startDuel('agent-1', 'p1');
    
    expect(duelId).toContain('duel:');
    expect(publishSpy).toHaveBeenCalledWith('logic_duel_started', expect.objectContaining({
      targetAgentId: 'agent-1',
      pathologicalId: 'p1'
    }), 'pathology');
  });
});
