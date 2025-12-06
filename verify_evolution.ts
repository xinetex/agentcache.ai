
import { createRandomGenome, mutate, crossover } from './src/lib/genetic/dna.js';

// Simulation Configuration
const POPULATION_SIZE = 10;
const GENERATIONS = 5;

// Mock Fitness Landscape (The "Truth" we want to discover)
// Goal: Enable L1 (fastest), Disable L2 (wasteful if L1 is good), Use 'lru'
function evaluateFitness(genome) {
    let score = 0;

    // 1. Hit Rate Reward
    if (genome.l1.enabled) score += 50;
    if (genome.l2.enabled) score += 20; // Diminishing return

    // 2. Latency Penalty
    // L1 is fast (ok), L2 is slower (penalty)
    if (genome.l1.enabled) score -= 1; // Overhead
    if (genome.l2.enabled) score -= 5; // Higher overhead

    // 3. Strategy Bonus
    if (genome.l1.strategy === 'lru') score += 10;

    // 4. Model Penalty (Cost)
    if (genome.model.provider === 'anthropic') score -= 10; // Expensive
    if (genome.model.provider === 'openai') score -= 5; // Moderate

    return score;
}

function runSimulation() {
    console.log('🌱 Genesis: Spawning Population...');
    let population = Array(POPULATION_SIZE).fill(0).map(() => createRandomGenome());

    for (let gen = 0; gen < GENERATIONS; gen++) {
        // Evaluate
        let totalFitness = 0;
        let maxFitness = -Infinity;

        population.forEach(g => {
            g.fitness = evaluateFitness(g);
            totalFitness += g.fitness;
            if (g.fitness > maxFitness) maxFitness = g.fitness;
        });

        const avgFitness = totalFitness / POPULATION_SIZE;
        console.log(`Generation ${gen}: Avg Fitness = ${avgFitness.toFixed(1)}, Max = ${maxFitness}`);

        // Selection
        population.sort((a, b) => b.fitness - a.fitness);
        const elites = population.slice(0, 3);

        // Reproduction
        const nextGen = [...elites];
        while (nextGen.length < POPULATION_SIZE) {
            const A = elites[Math.floor(Math.random() * elites.length)];
            const B = elites[Math.floor(Math.random() * elites.length)];
            let child = crossover(A, B);
            child = mutate(child, 0.2);
            nextGen.push(child);
        }
        population = nextGen;
    }

    console.log('\n🏆 Evolution Complete. Fittest Genome:');
    const winner = population[0];
    console.log(JSON.stringify(winner, null, 2));

    if (winner.l1.enabled && winner.l1.strategy === 'lru') {
        console.log('✅ Convergence Verified: Found Optimal Strategy (L1+LRU)');
    } else {
        console.error('❌ Failed to converge on optimal strategy');
    }
}

runSimulation();
