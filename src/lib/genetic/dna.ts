/**
 * Evolutionary Genetics Core
 * 
 * Defines the DNA structure for a Cache Pipeline and the 
 * operations for evolution (Mutation, Crossover).
 */

export interface CacheLayerGene {
    enabled: boolean;
    ttl: number; // Seconds
    strategy: 'lru' | 'lfu' | 'fifo';
}

export interface ModelGene {
    provider: 'openai' | 'anthropic' | 'moonshot';
    model: string;
    temperature: number;
}

export interface Genome {
    id: string;
    generation: number;
    fitness: number;

    // Genes
    l1: CacheLayerGene;
    l2: CacheLayerGene;
    model: ModelGene;

    // Metadata
    parents?: string[];
}

// Gene Pools for Mutation
const PROVIDERS = ['openai', 'anthropic', 'moonshot'];
const MODELS: Record<string, string[]> = {
    'openai': ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
    'anthropic': ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
    'moonshot': ['moonshot-v1-8k', 'moonshot-v1-32k']
};
const STRATEGIES = ['lru', 'lfu', 'fifo'] as const;

/**
 * Mutate a Genome based on Mutation Rate
 * Uses "Simulated Annealing" principle: Rate should decrease over generations.
 */
export function mutate(genome: Genome, mutationRate: number = 0.1): Genome {
    const mutant = JSON.parse(JSON.stringify(genome)) as Genome;
    mutant.id = crypto.randomUUID();
    mutant.parents = [genome.id]; // Asexual reproduction check

    // 1. Mutate L1
    if (Math.random() < mutationRate) {
        mutant.l1.enabled = !mutant.l1.enabled;
    }
    if (Math.random() < mutationRate) {
        // Mutate TTL by +/- 20%
        const factor = 1 + (Math.random() * 0.4 - 0.2);
        mutant.l1.ttl = Math.floor(Math.max(1, mutant.l1.ttl * factor));
    }

    // 2. Mutate L2
    if (Math.random() < mutationRate) {
        // Mutate Strategy
        mutant.l2.strategy = STRATEGIES[Math.floor(Math.random() * STRATEGIES.length)];
    }
    if (Math.random() < mutationRate) {
        // Dramatic TTL Mutation (Systems Math: Leap Logic)
        // Flip between Short (min) and Long (day)
        mutant.l2.ttl = Math.random() < 0.5 ? 60 : 86400;
    }

    // 3. Mutate Model
    if (Math.random() < mutationRate) {
        const newProvider = PROVIDERS[Math.floor(Math.random() * PROVIDERS.length)];
        mutant.model.provider = newProvider as any;
        mutant.model.model = MODELS[newProvider][0]; // Reset to default model of new provider
    }

    return mutant;
}

/**
 * Crossover (Sexual Reproduction)
 * Combines genes from two parents using Uniform Crossover.
 */
export function crossover(parentA: Genome, parentB: Genome): Genome {
    const child: Genome = {
        id: crypto.randomUUID(),
        generation: Math.max(parentA.generation, parentB.generation) + 1,
        fitness: 0, // Reset fitness

        // MIX GENES
        l1: Math.random() > 0.5 ? { ...parentA.l1 } : { ...parentB.l1 },
        l2: Math.random() > 0.5 ? { ...parentA.l2 } : { ...parentB.l2 },
        model: Math.random() > 0.5 ? { ...parentA.model } : { ...parentB.model },

        parents: [parentA.id, parentB.id]
    };

    return child;
}

/**
 * Generate a Random Genome (founder)
 */
export function createRandomGenome(): Genome {
    return {
        id: crypto.randomUUID(),
        generation: 0,
        fitness: 0,
        l1: { enabled: true, ttl: 60, strategy: 'lru' },
        l2: { enabled: true, ttl: 3600, strategy: 'lfu' },
        model: { provider: 'openai', model: 'gpt-4o-mini', temperature: 0.7 }
    };
}
