/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * verify_collective_state.ts: Verifies Pillar 2 (Cross-Domain Shared State).
 */

import { collectiveCortex } from '../src/services/CollectiveCortex.js';
import { sectorSolutionOrchestrator } from '../src/services/SectorSolutionOrchestrator.js';

async function verify() {
    console.log('🧪 Pillar 2: Cross-Domain Shared State Verification...');

    // 1. Spawn Two Specialized Agents
    const fintechAgent = await sectorSolutionOrchestrator.spawnSectorAgent('FINTECH');
    const legalAgent = await sectorSolutionOrchestrator.spawnSectorAgent('LEGAL');

    console.log(`Agents Spawned: ${fintechAgent.name} (Fintech) and ${legalAgent.name} (Legal)`);

    // 2. Initiate Joint Session
    const objective = "Establish a high-frequency trading protocol for carbon credits with automated legal-compliance auditing.";
    const session = await collectiveCortex.initiateSession(objective, [fintechAgent.agentId, legalAgent.agentId]);

    console.log(`Joint Session Initiated: ${session.id} | Objective: ${objective}`);
    const activeSessions = await collectiveCortex.listActiveSessions();
    const registered = activeSessions.find(candidate => candidate.id === session.id);
    console.log(`Indexed in Active Joint Sessions: ${registered ? 'YES' : 'NO'}`);

    // 3. Push Local States
    console.log('Pushing Fintech State...');
    await collectiveCortex.pushState(session.id, fintechAgent.agentId, {
        liquidityStatus: 'excess',
        tokenType: 'CARBON_V1',
        tradingVolume: 10000,
        riskTolerance: 0.1
    });

    console.log('Pushing Legal State...');
    await collectiveCortex.pushState(session.id, legalAgent.agentId, {
        regulatoryFrame: 'EU-ETS-2026',
        complianceCheck: 'PENDING',
        taxJurisdiction: 'IE',
        lastAuditTs: Date.now()
    });

    // 4. Verify Convergence ( директивы should be generated after both push)
    console.log('Verifying Convergence...');
    const fintechDirective = await collectiveCortex.getDirective(session.id, fintechAgent.agentId);
    const legalDirective = await collectiveCortex.getDirective(session.id, legalAgent.agentId);

    if (fintechDirective && legalDirective) {
        console.log('\n✅ CROSS-DOMAIN CONVERGENCE ATTAINED!');
        console.log(`[Directive for FINTECH]: ${fintechDirective}`);
        console.log(`[Directive for LEGAL]: ${legalDirective}`);
    } else {
        console.error('❌ Convergence failed or directives not found.');
    }
}

verify().catch(console.error);
