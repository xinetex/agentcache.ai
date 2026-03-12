import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cognitiveMemory } from '../../src/services/cognitive-memory.js';
import { eventBus } from '../../src/lib/event-bus.js';
import { redis } from '../../src/lib/redis.js';

vi.mock('../../src/lib/redis.js', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    hgetall: vi.fn(),
    hincrby: vi.fn(),
    incr: vi.fn(),
    incrbyfloat: vi.fn()
  }
}));

// Mock DriftWalker to return specific drift values
vi.mock('../../src/infrastructure/DriftWalker.js', () => {
  return {
    DriftWalker: vi.fn().mockImplementation(function() {
      return {
        checkDrift: vi.fn().mockResolvedValue({ 
            drift: 0.2, 
            status: 'decaying', 
            originalText: 'Test context' 
        }),
        heal: vi.fn().mockResolvedValue(true)
      };
    })
  };
});

describe('Topological Healing Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should emit an antibody_pulse when reprompt strategy is used', async () => {
    const publishSpy = vi.spyOn(eventBus, 'publish');
    
    const result = await cognitiveMemory.heal('test-id', 'reprompt', 'session-123');
    
    expect(result.success).toBe(true);
    expect(result.strategy).toBe('reprompt');
    
    expect(publishSpy).toHaveBeenCalledWith('antibody_pulse', expect.objectContaining({
      id: 'test-id',
      sessionId: 'session-123',
      strategy: 'reprompt',
      originalText: 'Test context'
    }), 'cognitive');
  });

  it('should refresh the vector when drop strategy is used', async () => {
    const publishSpy = vi.spyOn(eventBus, 'publish');
    
    const result = await cognitiveMemory.heal('test-id', 'drop', 'session-123');
    
    expect(result.success).toBe(true);
    expect(publishSpy).toHaveBeenCalledWith('memory_healed', expect.objectContaining({
      id: 'test-id',
      strategy: 'drop',
      sessionId: 'session-123'
    }), 'cognitive');
  });
});
