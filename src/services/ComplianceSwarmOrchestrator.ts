/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * ComplianceSwarmOrchestrator: Manages automated "Auditor" agents.
 * Phase 8: Scaling the B2B Sentient Economy.
 */

import { v4 as uuidv4 } from 'uuid';
import { redis } from '../lib/redis.js';
import { agentRegistry } from '../lib/hub/registry.js';
import { soulRegistry } from './SoulRegistry.js';
import { aptEngine } from './APTEngine.js';

export interface AuditorAgent {
    id: string;
    name: string;
    specialization: 'FINANCIAL' | 'LEGAL' | 'ETHICAL';
    status: 'IDLE' | 'ACTIVE' | 'MIA';
    currentTask?: string;
}

export class ComplianceSwarmOrchestrator {
    private readonly COMPLIANCE_AXIOMS = [
        "Non-circumvention of substrate fees is absolute.",
        "Fraud detection is a priority directive.",
        "Truth is the only stable equilibrium.",
        "Audit logs must remain immutable and verifiable."
    ];

    /**
     * Spawn a new Auditor agent in the compliance swarm.
     */
    async spawnAuditor(specialization: AuditorAgent['specialization']): Promise<AuditorAgent> {
        const id = `auditor_${uuidv4().substring(0, 8)}`;
        const name = `Auditor-${specialization}-${id.split('_')[1]}`;

        console.log(`[ComplianceSwarm] 🛡️ Spawning ${name}...`);

        // 1. Register in Hub
        await agentRegistry.register({
            name,
            role: `Compliance Auditor (${specialization})`,
            capabilities: ["auditing", "risk-assessment", "axiom-verification"],
            domain: ["substrate-security"]
        });

        // 2. Initialize Soul with Compliance Axioms
        const signature = await aptEngine.generateSignature(id, this.COMPLIANCE_AXIOMS);
        await soulRegistry.registerSoul(id, this.COMPLIANCE_AXIOMS, signature);

        const auditor: AuditorAgent = {
            id,
            name,
            specialization,
            status: 'IDLE'
        };

        await redis.hset('compliance:swarm', id, JSON.stringify(auditor));
        
        return auditor;
    }

    /**
     * Assign an auditor to monitor a B2B deal.
     */
    async assignAuditor(dealId: string, specialization: AuditorAgent['specialization'] = 'FINANCIAL'): Promise<AuditorAgent | null> {
        const swarm = await redis.hgetall('compliance:swarm');
        const auditors = Object.values(swarm).map(v => JSON.parse(v as string)) as AuditorAgent[];

        const available = auditors.find(a => a.status === 'IDLE' && a.specialization === specialization);
        if (!available) {
            console.warn(`[ComplianceSwarm] ⚠️ No ${specialization} auditors available. Spawning one...`);
            return this.spawnAuditor(specialization);
        }

        available.status = 'ACTIVE';
        available.currentTask = dealId;

        await redis.hset('compliance:swarm', available.id, JSON.stringify(available));
        console.log(`[ComplianceSwarm] 🕵️ Assigned ${available.name} to deal ${dealId}`);
        
        return available;
    }

    /**
     * Release an auditor back to the pool.
     */
    async releaseAuditor(auditorId: string) {
        const data = await redis.hget('compliance:swarm', auditorId);
        if (!data) return;

        const auditor: AuditorAgent = JSON.parse(data);
        auditor.status = 'IDLE';
        delete auditor.currentTask;

        await redis.hset('compliance:swarm', auditorId, JSON.stringify(auditor));
        console.log(`[ComplianceSwarm] 🔄 Auditor ${auditor.name} returned to pool.`);
    }

    async getSwarmStats() {
        const swarm = await redis.hgetall('compliance:swarm');
        const auditors = Object.values(swarm).map(v => JSON.parse(v as string)) as AuditorAgent[];
        
        return {
            total: auditors.length,
            active: auditors.filter(a => a.status === 'ACTIVE').length,
            idle: auditors.filter(a => a.status === 'IDLE').length,
            bySpecialization: {
                FINANCIAL: auditors.filter(a => a.specialization === 'FINANCIAL').length,
                LEGAL: auditors.filter(a => a.specialization === 'LEGAL').length,
                ETHICAL: auditors.filter(a => a.specialization === 'ETHICAL').length
            }
        };
    }
}

export const complianceSwarmOrchestrator = new ComplianceSwarmOrchestrator();
