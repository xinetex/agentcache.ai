import { describe, expect, it, vi } from 'vitest';
import { AgentCacheCognitiveService } from '../../src/services/cognitive-memory.js';

function createRedisMock() {
  const kv = new Map<string, string>();
  const hashes = new Map<string, Record<string, number>>();
  const sorted = new Map<string, Array<{ member: string; score: number }>>();

  return {
    async get(key: string) {
      return kv.get(key) ?? null;
    },
    async set(key: string, value: string) {
      kv.set(key, value);
      return 'OK';
    },
    async setex(key: string, _ttl: number, value: string) {
      kv.set(key, value);
      return 'OK';
    },
    async hgetall(key: string) {
      return hashes.get(key) ?? {};
    },
    async hincrby(key: string, field: string, amount: number) {
      const hash = hashes.get(key) ?? {};
      hash[field] = (hash[field] ?? 0) + amount;
      hashes.set(key, hash);
      return hash[field];
    },
    async zincrby(key: string, amount: number, member: string) {
      const entries = sorted.get(key) ?? [];
      const existing = entries.find((entry) => entry.member === member);
      if (existing) {
        existing.score += amount;
      } else {
        entries.push({ member, score: amount });
      }
      sorted.set(key, entries);
      return existing?.score ?? amount;
    },
    async zrange(
      key: string,
      start: number,
      stop: number,
      options?: { rev?: boolean; withScores?: boolean }
    ) {
      const entries = [...(sorted.get(key) ?? [])].sort((a, b) =>
        options?.rev ? b.score - a.score : a.score - b.score
      );
      const sliced = entries.slice(start, stop === -1 ? undefined : stop + 1);
      if (options?.withScores) {
        return sliced.flatMap((entry) => [entry.member, String(entry.score)]);
      }
      return sliced.map((entry) => entry.member);
    },
  };
}

describe('AgentCacheCognitiveService', () => {
  it('hydrates predicted query hashes into readable next-step suggestions', async () => {
    const redis = createRedisMock();
    await redis.set('cognitive:query:next-hash', 'redline msa');
    const synapse = {
      observe: vi.fn(),
      predict: vi.fn().mockResolvedValue([
        { hash: 'next-hash', probability: 1, depth: 1 },
      ]),
    };
    const service = new AgentCacheCognitiveService({ redis, synapse: synapse as any });

    const predictions = await service.predictNext('draft contract', 1);

    expect(predictions).toHaveLength(1);
    expect(predictions[0]?.query).toBe('redline msa');
    expect(predictions[0]?.probability).toBeGreaterThan(0);
    expect(synapse.predict).toHaveBeenCalled();
  });

  it('heals decaying memories when drift remediation is requested', async () => {
    const redis = createRedisMock();
    const driftWalker = {
      checkDrift: vi.fn().mockResolvedValue({ drift: 0.42, status: 'decaying', originalText: 'old' }),
      heal: vi.fn().mockResolvedValue(true),
    };
    const service = new AgentCacheCognitiveService({ redis, driftWalker: driftWalker as any });

    const result = await service.assessDrift('memory-1', true);

    expect(driftWalker.checkDrift).toHaveBeenCalledWith('memory-1');
    expect(driftWalker.heal).toHaveBeenCalledWith('memory-1');
    expect(result.healed).toBe(true);
    expect(result.status).toBe('decaying');
  });

  it('prefers newer fleet memories during sync', async () => {
    const redis = createRedisMock();
    await redis.set(
      'fleet:memory:shared-1',
      JSON.stringify({ id: 'shared-1', updatedAt: '2026-03-01T00:00:00.000Z', confidence: 0.4, nodeId: 'node-a' })
    );
    const service = new AgentCacheCognitiveService({ redis });

    const result = await service.mergeFleetMemories('node-b', [
      { id: 'shared-1', updatedAt: '2026-03-04T00:00:00.000Z', confidence: 0.6 },
    ]);

    expect(result.replaced).toBe(1);
    const stored = JSON.parse((await redis.get('fleet:memory:shared-1')) as string);
    expect(stored.nodeId).toBe('node-b');
    expect(stored.updatedAt).toBe('2026-03-04T00:00:00.000Z');
  });
});
