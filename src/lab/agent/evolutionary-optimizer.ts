/**
 * Evolutionary Optimizer Agent
 * 
 * Implements "Indirect Encoding" (Neuroevolution) for Caching Pipelines.
 * - Genome: Markov Chain (Transition Matrix)
 * - Phenotype: Pipeline Configuration
 * - Evolution: Survival of the Fittest
 */

import { inngest } from '../inngest/client.js';

// --- Types ---

type State = 'START' | 'L1_CHECK' | 'L2_CHECK' | 'L3_SEARCH' | 'COGNITIVE' | 'LLM_CALL' | 'END';

const STATES: State[] = ['START', 'L1_CHECK', 'L2_CHECK', 'L3_SEARCH', 'COGNITIVE', 'LLM_CALL', 'END'];

interface Genome {
    id: string;
    generation: number;
    transitions: Record<State, Record<State, number>>; // Adjacency Matrix
    fitness?: number;
    phenotype?: string[]; // The resulting pipeline steps
}

// --- Agent Definition ---

export const evolutionaryOptimizer = inngest.createFunction(
    {
        id: 'evolutionary-optimizer',
        name: 'Evolutionary Pipeline Optimizer',
    },
    { cron: '0 * * * *' }, // Run hourly (Evolution takes time)
    async ({ event, step }) => {

        // Step 1: Load or Initialize Population
        const population = await step.run('load-population', async () => {
            const response = await fetch(`${process.env.PUBLIC_URL}/api/lab/genomes?limit=10`, {
                headers: { 'Authorization': `Bearer ${process.env.SYSTEM_TOKEN}` }
            });
            const data = await response.json();

            if (data.genomes && data.genomes.length > 0) {
                return data.genomes;
            }

            // Bootstrap random population if empty
            return Array(10).fill(null).map(() => generateRandomGenome(0));
        });

        // Step 2: Evaluate Fitness (The "Life" Phase)
        const evaluatedPopulation = await step.run('evaluate-fitness', async () => {
            const results = [];
            for (const genome of population) {
                // Unfold Genome -> Phenotype
                const pipeline = unfoldGenome(genome);
                genome.phenotype = pipeline;

                // Run Simulation (Mock for now, would call actual Experiment API)
                const fitness = await simulatePipeline(pipeline);
                genome.fitness = fitness;
                results.push(genome);
            }
            return results;
        });

        // Step 3: Selection (Survival of the Fittest)
        const survivors = await step.run('selection', async () => {
            // Sort by fitness descending
            const sorted = evaluatedPopulation.sort((a, b) => (b.fitness || 0) - (a.fitness || 0));
            // Keep top 20%
            return sorted.slice(0, Math.ceil(sorted.length * 0.2));
        });

        // Step 4: Reproduction (Next Generation)
        const nextGeneration = await step.run('reproduction', async () => {
            const children: Genome[] = [];
            const targetSize = population.length;

            while (children.length < targetSize - survivors.length) {
                // Tournament Selection
                const parentA = survivors[Math.floor(Math.random() * survivors.length)];
                const parentB = survivors[Math.floor(Math.random() * survivors.length)];

                // Crossover
                let child = crossover(parentA, parentB);

                // Mutation
                if (Math.random() < 0.1) {
                    child = mutate(child);
                }

                children.push(child);
            }

            return [...survivors, ...children];
        });

        // Step 5: Persist Next Generation
        await step.run('persist-generation', async () => {
            const best = survivors[0];
            console.log(`Generation ${best.generation} Complete. Best Fitness: ${best.fitness}`);

            // Save all genomes in the new generation
            for (const genome of nextGeneration) {
                await fetch(`${process.env.PUBLIC_URL}/api/lab/genomes`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${process.env.SYSTEM_TOKEN}`
                    },
                    body: JSON.stringify({ genome })
                });
            }
        });

        return {
            generation: survivors[0].generation + 1,
            bestFitness: survivors[0].fitness,
            survivors: survivors.length,
        };
    }
);

// --- Helper Functions ---

function generateRandomGenome(generation: number): Genome {
    const transitions: any = {};

    STATES.forEach(from => {
        transitions[from] = {};
        let sum = 0;
        STATES.forEach(to => {
            // Random probability, but enforce some logic (e.g., END has no outgoing)
            if (from === 'END') {
                transitions[from][to] = 0;
            } else {
                const prob = Math.random();
                transitions[from][to] = prob;
                sum += prob;
            }
        });

        // Normalize
        if (sum > 0) {
            STATES.forEach(to => {
                transitions[from][to] /= sum;
            });
        }
    });

    return {
        id: `genome-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        generation,
        transitions,
    };
}

function unfoldGenome(genome: Genome): string[] {
    const pipeline: string[] = [];
    let currentState: State = 'START';
    let steps = 0;
    const MAX_STEPS = 10;

    while (currentState !== 'END' && steps < MAX_STEPS) {
        // Select next state based on transition probabilities
        const rand = Math.random();
        let cumulative = 0;
        let nextState: State = 'END'; // Default fallback

        for (const state of STATES) {
            cumulative += genome.transitions[currentState][state];
            if (rand <= cumulative) {
                nextState = state;
                break;
            }
        }

        if (nextState !== 'START' && nextState !== 'END') {
            pipeline.push(nextState);
        }

        currentState = nextState;
        steps++;
    }

    return pipeline;
}

function crossover(parentA: Genome, parentB: Genome): Genome {
    const childTransitions: any = {};

    STATES.forEach(from => {
        childTransitions[from] = {};
        STATES.forEach(to => {
            // Average probabilities
            childTransitions[from][to] = (parentA.transitions[from][to] + parentB.transitions[from][to]) / 2;
        });
    });

    return {
        id: `child-${Date.now()}`,
        generation: parentA.generation + 1,
        transitions: childTransitions,
    };
}

function mutate(genome: Genome): Genome {
    const mutatedTransitions = JSON.parse(JSON.stringify(genome.transitions));

    // Pick a random state transition to perturb
    const from = STATES[Math.floor(Math.random() * (STATES.length - 1))]; // Exclude END
    const to = STATES[Math.floor(Math.random() * STATES.length)];

    mutatedTransitions[from][to] = Math.random(); // Assign new random probability

    // Re-normalize row
    let sum = 0;
    STATES.forEach(s => sum += mutatedTransitions[from][s]);
    STATES.forEach(s => mutatedTransitions[from][s] /= sum);

    return {
        ...genome,
        id: `mutant-${Date.now()}`,
        transitions: mutatedTransitions,
    };
}

async function simulatePipeline(pipeline: string[]): Promise<number> {
    // Mock Simulation:
    // - Longer pipelines = Higher Cost/Latency penalty
    // - "L1" -> "L3" is a good pattern (Bonus)
    // - "L3" -> "L1" is bad (Penalty)

    let score = 50; // Base score

    // Length Penalty
    score -= pipeline.length * 2;

    // Pattern Bonuses
    const str = pipeline.join(',');
    if (str.includes('L1_CHECK,L3_SEARCH')) score += 20;
    if (str.includes('L3_SEARCH,COGNITIVE')) score += 15;
    if (str.includes('COGNITIVE,LLM_CALL')) score += 10;

    // Random noise (Environment variance)
    score += (Math.random() - 0.5) * 10;

    return Math.max(0, Math.min(100, score));
}
