import { redis } from '../../src/lib/redis.js';
import { createRandomGenome, mutate, crossover, Genome } from '../../src/lib/genetic/dna.js';

export const config = { runtime: 'nodejs' };

const POPULATION_SIZE = 10;
const GENERATION_KEY = 'game:evolution:population';
const METRICS_KEY = 'game:evolution:metrics';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { action } = req.body;

        if (action === 'init') {
            // Genesis: Create initial random population
            const population = [];
            for (let i = 0; i < POPULATION_SIZE; i++) {
                population.push(createRandomGenome());
            }
            await redis.set(GENERATION_KEY, JSON.stringify(population));
            return res.status(200).json({ message: 'Genesis complete', generation: 0, count: population.length });
        }

        if (action === 'evolve') {
            // Evolution Step
            // 1. Load current population
            const popJson = await redis.get(GENERATION_KEY);
            if (!popJson) return res.status(400).json({ error: 'No population found. Run init first.' });

            let population = JSON.parse(popJson);

            // 2. Load Fitness Metrics (reported by loop.js)
            const metricsJson = await redis.get(METRICS_KEY);
            const metrics = metricsJson ? JSON.parse(metricsJson) : {};

            // 3. Assign Fitness
            population.forEach(genome => {
                const stat = metrics[genome.id];
                if (stat) {
                    // Fitness Function: HitRate * 100 - Latency * 0.1
                    // Example: 90% hit, 50ms latency -> 90 - 5 = 85
                    const hitRate = (stat.hits / (stat.hits + stat.misses)) * 100 || 0;
                    const latencyPenalty = (stat.avgLatency || 0) * 0.1;
                    genome.fitness = hitRate - latencyPenalty;
                } else {
                    genome.fitness = -999; // Did not run
                }
            });

            // 4. Selection (Survival of the Fittest)
            population.sort((a, b) => b.fitness - a.fitness); // Descending
            const elites = population.slice(0, 3); // Top 3 survive

            // 5. Reproduction (Crossover & Mutation)
            const nextGen = [...elites]; // Elites pass directly

            while (nextGen.length < POPULATION_SIZE) {
                // Tournament Selection for parents
                const parentA = elites[Math.floor(Math.random() * elites.length)];
                const parentB = elites[Math.floor(Math.random() * elites.length)];

                let child = crossover(parentA, parentB);
                child = mutate(child, 0.2); // 20% Mutation Rate
                nextGen.push(child);
            }

            // 6. Save Next Generation
            await redis.set(GENERATION_KEY, JSON.stringify(nextGen));
            // Reset metrics for new generation
            await redis.del(METRICS_KEY);

            return res.status(200).json({
                message: 'Evolution complete',
                generation: nextGen[0].generation,
                fitness_avg: population.reduce((a, b) => a + b.fitness, 0) / population.length,
                top_fitness: elites[0].fitness
            });
        }

        // Helper: Get current active genome for the Game Loop to test
        if (action === 'get_active') {
            const popJson = await redis.get(GENERATION_KEY);
            if (!popJson) return res.status(404).json({ error: 'No population' });
            const population = JSON.parse(popJson);

            // Round-Robin or Random selection for testing
            const genome = population[Math.floor(Math.random() * population.length)];
            return res.status(200).json({ genome });
        }

        return res.status(400).json({ error: 'Invalid action' });

    } catch (error) {
        console.error('Evolution error:', error);
        return res.status(500).json({ error: error.message });
    }
}
