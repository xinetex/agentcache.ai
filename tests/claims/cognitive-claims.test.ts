import { describe, expect, it } from 'vitest';
import { createHash } from 'crypto';
import { AgentCacheCognitiveService } from '../../src/services/cognitive-memory.js';
import { upsertMemory, vectorIndex } from '../../src/lib/vector.js';
import { generateEmbedding } from '../../src/lib/llm/embeddings.js';
import { redis } from '../../src/lib/redis.js';

function createRedisMock() {
  const kv = new Map<string, string>();
  const hashes = new Map<string, Record<string, number | string>>();
  const sorted = new Map<string, Map<string, number>>();

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
    async hget(key: string, field: string) {
      return hashes.get(key)?.[field] ?? null;
    },
    async hset(key: string, field: string, value: string | number) {
      const hash = hashes.get(key) ?? {};
      hash[field] = value;
      hashes.set(key, hash);
      return 1;
    },
    async hdel(key: string, field: string) {
      const hash = hashes.get(key) ?? {};
      if (!(field in hash)) return 0;
      delete hash[field];
      hashes.set(key, hash);
      return 1;
    },
    async hincrby(key: string, field: string, amount: number) {
      const hash = hashes.get(key) ?? {};
      const next = Number(hash[field] ?? 0) + amount;
      hash[field] = next;
      hashes.set(key, hash);
      return next;
    },
    async incr(key: string) {
      const next = Number(kv.get(key) ?? 0) + 1;
      kv.set(key, String(next));
      return next;
    },
    async del(key: string) {
      const existed = kv.delete(key);
      return existed ? 1 : 0;
    },
    async zincrby(key: string, amount: number, member: string) {
      const set = sorted.get(key) ?? new Map<string, number>();
      const next = (set.get(member) ?? 0) + amount;
      set.set(member, next);
      sorted.set(key, set);
      return next;
    },
    async zrange(
      key: string,
      start: number,
      stop: number,
      options?: { rev?: boolean; withScores?: boolean }
    ) {
      const entries = Array.from((sorted.get(key) ?? new Map()).entries()).sort((a, b) =>
        options?.rev ? b[1] - a[1] : a[1] - b[1]
      );
      const sliced = entries.slice(start, stop === -1 ? undefined : stop + 1);
      if (options?.withScores) {
        return sliced.flatMap(([member, score]) => [member, String(score)]);
      }
      return sliced.map(([member]) => member);
    },
  };
}

function unique(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function queryHash(query: string) {
  return createHash('sha256')
    .update(query.toLowerCase().trim().replace(/[?.!]$/, ''))
    .digest('hex');
}

describe.sequential('AgentCache cognitive claim coverage', () => {
  it('Predictive Synapse learns a transition and prefetches the likely next query', async () => {
    const redisMock = createRedisMock();
    const service = new AgentCacheCognitiveService({ redis: redisMock as any });
    const previous = unique('claim-prev');
    const current = unique('claim-next');

    await service.observeTransition(previous, current);
    const predictions = await service.predictNext(previous, 1);
    const currentHash = queryHash(current);

    expect(predictions).toHaveLength(1);
    expect(predictions[0]?.hash).toBe(currentHash);
    expect(predictions[0]?.probability).toBe(1);
    expect(await redisMock.get(`cognitive:query:${currentHash}`)).toBe(current);
  });

  it('DriftWalker detects semantic rot and heals the memory back to healthy state', async () => {
    const id = unique('claim-drift');
    const text = unique('memory-text');

    await upsertMemory(id, text, { query: text, claim: 'drift' });
    const fresh = await generateEmbedding(text);
    await vectorIndex.upsert({
      id,
      vector: fresh.map((value) => value * -1),
      metadata: { query: text, claim: 'drift' },
      data: text,
    });

    const service = new AgentCacheCognitiveService({ redis });
    const beforeHeal = await service.assessDrift(id, true);
    const afterHeal = await service.assessDrift(id, false);

    expect(beforeHeal.status).toBe('dead');
    expect(beforeHeal.healed).toBe(true);
    expect(afterHeal.status).toBe('healthy');
  });

  it('Neural Evolution emits a concrete winning cache strategy from live hit and miss metrics', async () => {
    const redisMock = createRedisMock();
    const service = new AgentCacheCognitiveService({ redis: redisMock as any });

    await service.recordCacheOutcome(true);
    await service.recordCacheOutcome(true);
    await service.recordCacheOutcome(false);

    const result = await service.evolveStrategy(2, 6);

    expect(result.generations).toBe(2);
    expect(result.populationSize).toBe(6);
    expect(result.best.ttlSeconds).toBeGreaterThanOrEqual(300);
    expect(result.best.prefetchDepth).toBeGreaterThanOrEqual(1);
    expect(result.metrics.hitRate).toBeGreaterThan(0);
  });

  it('Fleet Learning prefers newer knowledge during sync and replaces stale entries', async () => {
    const redisMock = createRedisMock();
    const service = new AgentCacheCognitiveService({ redis: redisMock as any });
    const memoryId = unique('fleet-memory');

    const initial = await service.mergeFleetMemories('node-a', [
      { id: memoryId, updatedAt: '2026-03-01T00:00:00.000Z', confidence: 0.4 },
    ]);
    const updated = await service.mergeFleetMemories('node-b', [
      { id: memoryId, updatedAt: '2026-03-04T00:00:00.000Z', confidence: 0.9 },
    ]);

    expect(initial.merged).toBe(1);
    expect(updated.replaced).toBe(1);
    expect(updated.ignored).toBe(0);
  });
});
