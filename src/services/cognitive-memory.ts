import { createHash } from 'crypto';
import { PredictiveSynapse } from '../infrastructure/PredictiveSynapse.js';
import { DriftWalker } from '../infrastructure/DriftWalker.js';
import { redis as defaultRedis } from '../lib/redis.js';

export interface FleetMemoryRecord {
  id: string;
  contentHash?: string;
  updatedAt?: string;
  confidence?: number;
  metadata?: Record<string, any>;
}

export interface FleetSyncResult {
  merged: number;
  replaced: number;
  ignored: number;
  nodeId: string;
  lastSeenAt: string;
}

export interface GenomeCandidate {
  ttlSeconds: number;
  semanticThreshold: number;
  prefetchDepth: number;
  prewarmCount: number;
}

export interface DriftResult {
  drift: number;
  status: 'healthy' | 'decaying' | 'dead';
  originalText?: string;
  healed: boolean;
}

function normalizeQuery(query: string): string {
  return query.toLowerCase().trim().replace(/[?.!]$/, '');
}

function queryHash(query: string): string {
  return createHash('sha256').update(normalizeQuery(query)).digest('hex');
}

function toNumber(value: unknown, fallback: number = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export class AgentCacheCognitiveService {
  private synapse: PredictiveSynapse;
  private driftWalker: DriftWalker;
  private redis: any;

  constructor(options?: {
    synapse?: PredictiveSynapse;
    driftWalker?: DriftWalker;
    redis?: any;
  }) {
    this.redis = options?.redis || defaultRedis;
    this.synapse = options?.synapse || new PredictiveSynapse(this.redis);
    this.driftWalker = options?.driftWalker || new DriftWalker();
  }

  private async bumpMetric(field: string, amount: number = 1): Promise<void> {
    await this.redis.hincrby('cognitive:metrics', field, amount);
  }

  private async rememberQuery(hash: string, query: string): Promise<void> {
    await this.redis.setex(`cognitive:query:${hash}`, 60 * 60 * 24 * 30, query);
  }

  async observeTransition(previousQuery?: string, currentQuery?: string): Promise<void> {
    if (!currentQuery || currentQuery.trim().length < 2) return;

    const currentHash = queryHash(currentQuery);
    await this.rememberQuery(currentHash, currentQuery);

    if (!previousQuery || previousQuery.trim().length < 2) return;

    const previousHash = queryHash(previousQuery);
    await this.rememberQuery(previousHash, previousQuery);
    await this.synapse.observe(previousHash, currentHash);
    await this.bumpMetric('observations');
  }

  async predictNext(query: string, depth: number = 1): Promise<Array<{
    hash: string;
    query: string;
    probability: number;
    depth: number;
    next?: any[];
  }>> {
    const hash = queryHash(query);
    await this.rememberQuery(hash, query);

    const predictions = await this.synapse.predict(hash, Math.max(1, Math.min(depth, 3)));
    const hydrated = await Promise.all(
      predictions.map(async (prediction) => ({
        ...prediction,
        query: (await this.redis.get(`cognitive:query:${prediction.hash}`)) || prediction.hash,
        next: prediction.next,
      }))
    );

    return hydrated;
  }

  async recordCacheOutcome(hit: boolean): Promise<void> {
    await this.bumpMetric(hit ? 'hits' : 'misses');
  }

  async assessDrift(id: string, heal: boolean = false): Promise<DriftResult> {
    await this.bumpMetric('drift_checks');
    const result = await this.driftWalker.checkDrift(id);
    let healed = false;

    if (heal && result.status !== 'healthy') {
      healed = await this.driftWalker.heal(id);
      if (healed) {
        await this.bumpMetric('drift_heals');
      }
    }

    return {
      ...result,
      healed,
    };
  }

  async evolveStrategy(generations: number = 1, populationSize: number = 8) {
    const rawMetrics = await this.redis.hgetall('cognitive:metrics');
    const hits = toNumber(rawMetrics.hits);
    const misses = toNumber(rawMetrics.misses);
    const total = hits + misses;
    const hitRate = total > 0 ? hits / total : 0;
    const missRate = total > 0 ? misses / total : 1;

    let population: GenomeCandidate[] = [
      { ttlSeconds: 3600, semanticThreshold: 0.82, prefetchDepth: 1, prewarmCount: 1 },
      { ttlSeconds: 21600, semanticThreshold: 0.88, prefetchDepth: 2, prewarmCount: 2 },
      { ttlSeconds: 86400, semanticThreshold: 0.9, prefetchDepth: 2, prewarmCount: 3 },
      { ttlSeconds: 604800, semanticThreshold: 0.93, prefetchDepth: 3, prewarmCount: 4 },
    ];

    while (population.length < populationSize) {
      const seed = population[population.length % 4];
      population.push({
        ttlSeconds: Math.max(300, Math.round(seed.ttlSeconds * (0.75 + population.length * 0.03))),
        semanticThreshold: Math.min(0.98, seed.semanticThreshold + population.length * 0.005),
        prefetchDepth: Math.min(3, seed.prefetchDepth + (population.length % 2)),
        prewarmCount: Math.min(6, seed.prewarmCount + (population.length % 3)),
      });
    }

    const score = (candidate: GenomeCandidate) => {
      const ttlTarget = hitRate > 0.75 ? 86400 : 21600;
      const ttlFitness = 1 - Math.min(1, Math.abs(candidate.ttlSeconds - ttlTarget) / 604800);
      const thresholdTarget = missRate > 0.45 ? 0.82 : 0.9;
      const thresholdFitness = 1 - Math.abs(candidate.semanticThreshold - thresholdTarget);
      const prefetchFitness =
        1 - Math.min(1, Math.abs(candidate.prefetchDepth - (hitRate > 0.6 ? 2 : 1)) / 3);
      const prewarmFitness =
        1 - Math.min(1, Math.abs(candidate.prewarmCount - (missRate > 0.5 ? 1 : 3)) / 6);

      return ttlFitness * 0.3 + thresholdFitness * 0.25 + prefetchFitness * 0.25 + prewarmFitness * 0.2;
    };

    let best = population[0];
    let bestScore = score(best);

    for (let generation = 0; generation < generations; generation++) {
      const ranked = population
        .map((candidate) => ({ candidate, fitness: score(candidate) }))
        .sort((a, b) => b.fitness - a.fitness);

      best = ranked[0].candidate;
      bestScore = ranked[0].fitness;

      const elite = ranked
        .slice(0, Math.max(2, Math.ceil(ranked.length * 0.25)))
        .map((entry) => entry.candidate);
      const nextPopulation = [...elite];

      while (nextPopulation.length < populationSize) {
        const a = elite[nextPopulation.length % elite.length];
        const b = elite[(nextPopulation.length + 1) % elite.length];
        nextPopulation.push({
          ttlSeconds: Math.max(300, Math.round((a.ttlSeconds + b.ttlSeconds) / 2)),
          semanticThreshold:
            Math.min(0.99, (a.semanticThreshold + b.semanticThreshold) / 2 + 0.01),
          prefetchDepth: Math.min(
            3,
            Math.max(1, Math.round((a.prefetchDepth + b.prefetchDepth) / 2))
          ),
          prewarmCount: Math.min(
            6,
            Math.max(1, Math.round((a.prewarmCount + b.prewarmCount) / 2))
          ),
        });
      }

      population = nextPopulation;
    }

    await this.redis.set(
      'cognitive:evolution:last',
      JSON.stringify({
        generatedAt: new Date().toISOString(),
        best,
        fitness: bestScore,
        generations,
        populationSize,
        metrics: { hits, misses, hitRate, missRate },
      })
    );
    await this.bumpMetric('evolution_runs');

    return {
      best,
      fitness: bestScore,
      generations,
      populationSize,
      metrics: { hits, misses, hitRate, missRate },
    };
  }

  async mergeFleetMemories(nodeId: string, memories: FleetMemoryRecord[]): Promise<FleetSyncResult> {
    let merged = 0;
    let replaced = 0;
    let ignored = 0;

    for (const memory of memories) {
      if (!memory?.id) {
        ignored += 1;
        continue;
      }

      const key = `fleet:memory:${memory.id}`;
      const existingRaw = await this.redis.get(key);
      const existing = existingRaw ? JSON.parse(existingRaw) : null;

      if (!existing) {
        await this.redis.set(key, JSON.stringify({ ...memory, nodeId }));
        merged += 1;
        continue;
      }

      const incomingTime = new Date(memory.updatedAt || 0).getTime();
      const existingTime = new Date(existing.updatedAt || 0).getTime();
      const incomingConfidence = toNumber(memory.confidence);
      const existingConfidence = toNumber(existing.confidence);

      if (
        incomingTime > existingTime ||
        (incomingTime === existingTime && incomingConfidence > existingConfidence)
      ) {
        await this.redis.set(key, JSON.stringify({ ...memory, nodeId }));
        replaced += 1;
      } else {
        ignored += 1;
      }
    }

    const lastSeenAt = new Date().toISOString();
    await this.redis.set(
      `fleet:node:${nodeId}`,
      JSON.stringify({ lastSeenAt, memoryCount: memories.length })
    );
    await this.bumpMetric('fleet_merges', merged + replaced);

    return {
      merged,
      replaced,
      ignored,
      nodeId,
      lastSeenAt,
    };
  }

  async getStatus() {
    const rawMetrics = await this.redis.hgetall('cognitive:metrics');
    const lastEvolutionRaw = await this.redis.get('cognitive:evolution:last');
    const hits = toNumber(rawMetrics.hits);
    const misses = toNumber(rawMetrics.misses);
    const total = hits + misses;

    return {
      predictive_synapse: {
        status: 'active',
        observations: toNumber(rawMetrics.observations),
        hitRate: total > 0 ? hits / total : 0,
      },
      drift_walker: {
        status: 'active',
        checks: toNumber(rawMetrics.drift_checks),
        heals: toNumber(rawMetrics.drift_heals),
      },
      neural_evolution: {
        status: 'active',
        runs: toNumber(rawMetrics.evolution_runs),
        latest: lastEvolutionRaw ? JSON.parse(lastEvolutionRaw) : null,
      },
      fleet_learning: {
        status: 'active',
        merges: toNumber(rawMetrics.fleet_merges),
      },
      metrics: {
        hits,
        misses,
        observations: toNumber(rawMetrics.observations),
      },
    };
  }
}

export const cognitiveMemory = new AgentCacheCognitiveService();
