
import { Genome, mutate, crossover, createRandomGenome } from '../genetic/dna.js';

/**
 * Confucius Meta-Agent
 * 
 * "The Supervisor of Evolution"
 * 
 * Based on the Confucius Code Agent paper [arXiv:2512.10398], this agent
 * implements the "Meta-Agent" pattern. Instead of passive evolution,
 * this agent actively monitors the fitness landscape and tunes the 
 * evolutionary hyperparameters (Mutation Rate, Population Size) dynamically.
 * 
 * It acts as a "System 2" wrapper around the "System 1" genetic algorithm.
 */

export interface EvolutionConfig {
    populationSize: number;
    mutationRate: number;
    generations: number;
}

export class MetaAgent {
    private population: Genome[] = [];
    private config: EvolutionConfig;
    private history: { generation: number, distinctiveness: number, avgFitness: number }[] = [];

    constructor(config: EvolutionConfig = { populationSize: 20, mutationRate: 0.1, generations: 10 }) {
        this.config = config;
        this.initializePopulation();
    }

    private initializePopulation() {
        for (let i = 0; i < this.config.populationSize; i++) {
            this.population.push(createRandomGenome());
        }
    }

    /**
     * The core "Build-Test-Improve" loop from Confucius.
     * Evaluates the current generation and decides how to evolve.
     */
    public async evolveGeneration(fitnessFunction: (g: Genome) => Promise<number>): Promise<Genome> {
        // 1. Evaluate Fitness
        console.log(`[MetaAgent] Evaluating Generation...`);
        for (const genome of this.population) {
            if (genome.fitness === 0) { // Only evaluate if new
                genome.fitness = await fitnessFunction(genome);
            }
        }

        // 2. Sort by Fitness
        this.population.sort((a, b) => b.fitness - a.fitness);
        const best = this.population[0];
        const avgFitness = this.population.reduce((sum, g) => sum + g.fitness, 0) / this.population.length;

        // 3. Analyze Diversity (Entropy)
        const distinctiveness = this.calculatePopulationEntropy();
        this.history.push({
            generation: best.generation,
            distinctiveness,
            avgFitness
        });

        console.log(`[MetaAgent] Best Fitness: ${best.fitness.toFixed(4)} | Entropy: ${distinctiveness.toFixed(4)}`);

        // 4. Meta-Cognition: Adjust Hyperparameters
        this.tuneHyperparameters(distinctiveness, avgFitness);

        // 5. Reproduction (Elitism + Crossover + Mutation)
        const nextGen: Genome[] = [best]; // Elitism (Keep #1)

        while (nextGen.length < this.config.populationSize) {
            // Tournament Selection
            const p1 = this.selectParent();
            const p2 = this.selectParent();

            let child = crossover(p1, p2);
            child = mutate(child, this.config.mutationRate);
            nextGen.push(child);
        }

        this.population = nextGen;
        return best;
    }

    /**
     * DYNAMIC ADAPTATION (The "Confucius" Logic)
     * If the population is stagnating (Low Entropy), increase mutation (Exploration).
     * If the population is volatile (High Entropy), decrease mutation (Exploitation).
     */
    private tuneHyperparameters(entropy: number, currentFitness: number) {
        // Stagnation Detection
        if (entropy < 0.1) {
            console.log(`[MetaAgent] ⚠️ Stagnation detected. Boosting Mutation Rate.`);
            this.config.mutationRate = Math.min(0.5, this.config.mutationRate * 1.5);
        } else if (entropy > 0.8) {
            console.log(`[MetaAgent] High volatility. Lowering Mutation Rate.`);
            this.config.mutationRate = Math.max(0.01, this.config.mutationRate * 0.8);
        }

        // Fitness Plateau check
        if (this.history.length > 3) {
            const prev = this.history[this.history.length - 2].avgFitness;
            if (Math.abs(currentFitness - prev) < 0.001) {
                console.log(`[MetaAgent] Fitness Plateau. Injecting Random Blood.`);
                // Replace bottom 20% with fresh random genomes
                const cutoff = Math.floor(this.config.populationSize * 0.8);
                this.population = this.population.slice(0, cutoff);
                while (this.population.length < this.config.populationSize) {
                    this.population.push(createRandomGenome());
                }
            }
        }
    }

    private selectParent(): Genome {
        // Simple Tournament Selection
        const candidates = [
            this.population[Math.floor(Math.random() * this.population.length)],
            this.population[Math.floor(Math.random() * this.population.length)],
            this.population[Math.floor(Math.random() * this.population.length)]
        ];
        return candidates.sort((a, b) => b.fitness - a.fitness)[0];
    }

    /**
     * A heuristic for "Genetic Entropy" - how different are the genomes?
     * Uses Strategy + Provider variance as proxy.
     */
    private calculatePopulationEntropy(): number {
        const uniqueStrategies = new Set(this.population.map(g => g.l2.strategy)).size;
        const uniqueModels = new Set(this.population.map(g => g.model.model)).size;

        // Normalize: (Uniques / Total)
        const stratScore = uniqueStrategies / 3; // 3 strategies
        const modelScore = uniqueModels / 5; // approx 5-6 models

        return (stratScore + modelScore) / 2;
    }

    public getBestGenome(): Genome {
        return this.population[0]; // Assumes sorted
    }
}
