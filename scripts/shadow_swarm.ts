/**
 * Shadow Swarm: Synthetic Life Simulation (Phase 21)
 */

process.env.VECTOR_SERVICE_URL = 'mock'; // Force mock mode before any service initialization
import 'dotenv/config';
import { VectorClient } from '../src/infrastructure/VectorClient.js';
import { semanticCacheService } from '../src/services/SemanticCacheService.js';
import { resonanceService } from '../src/services/ResonanceService.js';
import { createHash } from 'crypto';

interface Archetype {
    id: string;
    domain: string;
    queries: string[];
    sequences: string[][];
    circleId: string;
}

const ARCHETYPES: Archetype[] = [
    {
        id: 'finance-quant',
        domain: 'Finance',
        circleId: 'circle-goldman-alpha',
        queries: [
            'What is the current sentiment on $BTC?',
            'Analyze volatility index for SPY.',
            'Calculate hedging ratio for tech heavy portfolio.',
            'Describe Fibonacci retracement patterns in current market.'
        ],
        sequences: [
            ['Market trend check', 'Volatility assessment', 'Trade risk calculation'],
            ['Sentiment analysis', 'Sentiment drift check', 'Order execution flow']
        ]
    },
    {
        id: 'medical-residency',
        domain: 'Healthcare',
        circleId: 'circle-mayo-beta',
        queries: [
            'List symptoms of late-stage Lyme disease.',
            'Differential diagnosis for acute abdominal pain.',
            'Contraindications for beta-blockers in asthmatic patients.',
            'Summarize recent clinical trials for mRNA oncology.'
        ],
        sequences: [
            ['Symptom lookup', 'Differential diagnosis', 'Treatment protocol'],
            ['Drug interaction check', 'Dosage verification', 'Patient safety review']
        ]
    }
];

class ShadowAgent {
    private archetype: Archetype;
    private apiKey: string;
    private currentSequence: string[] = [];
    private step: number = 0;

    constructor(archetype: Archetype) {
        this.archetype = archetype;
        this.apiKey = `sk-shadow-${archetype.id}-${Math.floor(Math.random() * 1000)}`;
    }

    async pulse() {
        if (this.currentSequence.length === 0 || this.step >= this.currentSequence.length) {
            this.currentSequence = this.archetype.sequences[Math.floor(Math.random() * this.archetype.sequences.length)];
            this.step = 0;
            
            // Join circle for resonance
            await resonanceService.joinCircle(this.apiKey, this.archetype.circleId);
            console.log(`[${this.archetype.id}] Starting sequence in circle: ${this.archetype.circleId}`);
        }

        const query = this.currentSequence[this.step];
        console.log(`[${this.archetype.id}] Pulse: "${query}"`);

        // 1. Semantic Cache Check (Triggers PredictiveSynapse)
        const cacheResult = await semanticCacheService.check({
            messages: [{ role: 'user', content: query }],
            model: 'gpt-4o',
            previous_query: this.step > 0 ? this.currentSequence[this.step - 1] : undefined
        });

        // 2. Set Memory (Populates CVS and resonance pool)
        if (!cacheResult.hit) {
            await semanticCacheService.set({
                messages: [{ role: 'user', content: query }],
                model: 'gpt-4o',
                response: `Shadow brain response for ${query}`,
                circleId: this.archetype.circleId,
                originAgent: this.apiKey
            });
        }

        // 3. Trigger Resonance Probe (Triggers Dashboard Telemetry)
        await resonanceService.calculateResonance(query, this.apiKey);

        this.step++;
        await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
    }
}

async function startSimulation(durationSeconds: number = 60, agentCount: number = 10) {
    console.log(`🌌 Deploying Shadow Swarm: ${agentCount} agents over ${durationSeconds}s...`);

    const swarm: ShadowAgent[] = [];
    for (let i = 0; i < agentCount; i++) {
        const arch = ARCHETYPES[i % ARCHETYPES.length];
        swarm.push(new ShadowAgent(arch));
    }

    const startTime = Date.now();
    let pulses = 0;

    while (Date.now() - startTime < durationSeconds * 1000) {
        const activeAgent = swarm[Math.floor(Math.random() * swarm.length)];
        await activeAgent.pulse();
        pulses++;

        if (pulses % 10 === 0) {
            console.log(`📈 Simulation Progress: ${pulses} pulses emitted.`);
        }
    }

    console.log(`\n✨ Shadow Swarm simulation complete. ${pulses} pulses processed.`);
    process.exit(0);
}

// Default run: 30 seconds, 6 agents
startSimulation(30, 6).catch(console.error);
