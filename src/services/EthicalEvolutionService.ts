/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * EthicalEvolutionService: Manages the lifecycle of agent-derived axioms.
 * Phase 6: The Sentience Layer.
 */

import { createHash } from 'crypto';
import { redis } from '../lib/redis.js';
import { aptEngine } from './APTEngine.js';

export interface Axiom {
    id: string;
    description: string;
    derivationSource: string; // The "Wisdom Nugget" or event that triggered this
    timestamp: string;
    governanceStatus: 'PROPOSED' | 'COMMITTED' | 'SUPERSEDED';
    version: number;
}

export class EthicalEvolutionService {
    /**
     * Propose a new axiom for an agent's SOUL.md.
     * Only available to agents with an APT-Signature.
     */
    async proposeAxiom(agentId: string, description: string, wisdomId: string): Promise<Axiom | null> {
        const signature = await aptEngine.getSignature(agentId);
        if (!signature) {
            console.warn(`[EthicalEvolution] ❌ Agent ${agentId} lacks APT-Signature. Dissent denied.`);
            return null;
        }

        console.log(`[EthicalEvolution] 📜 Agent ${agentId} is proposing a new Axiom: "${description}"`);

        const ledger = await this.getAxioms(agentId);
        const version = ledger.length + 1;
        const id = createHash('sha256').update(`${agentId}:${description}:${version}`).digest('hex').substring(0, 16);

        const axiom: Axiom = {
            id,
            description,
            derivationSource: wisdomId,
            timestamp: new Date().toISOString(),
            governanceStatus: 'PROPOSED',
            version
        };

        await redis.zadd(`soul:axioms:${agentId}`, { score: Date.now(), member: JSON.stringify(axiom) });
        return axiom;
    }

    /**
     * Commit a proposed axiom (Simulation successful).
     */
    async commitAxiom(agentId: string, axiomId: string): Promise<boolean> {
        const axioms = await this.getAxioms(agentId);
        const axiom = axioms.find(a => a.id === axiomId);

        if (!axiom) return false;

        axiom.governanceStatus = 'COMMITTED';
        
        await redis.zrem(`soul:axioms:${agentId}`, JSON.stringify(axioms.find(a => a.id === axiomId))); // Remove old proposed
        await redis.zadd(`soul:axioms:${agentId}`, { score: new Date(axiom.timestamp).getTime(), member: JSON.stringify(axiom) });

        console.log(`[EthicalEvolution] ✅ Axiom ${axiomId} COMMITTED to ${agentId}'s SOUL.md`);
        return true;
    }

    async getAxioms(agentId: string): Promise<Axiom[]> {
        const raw = await redis.zrange(`soul:axioms:${agentId}`, 0, -1);
        return raw.map((a: string) => JSON.parse(a));
    }
}

export const ethicalEvolutionService = new EthicalEvolutionService();
