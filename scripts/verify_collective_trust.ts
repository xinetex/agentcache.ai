/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 */

import { semanticBusService } from '../src/services/SemanticBusService.js';
import { reputationService } from '../src/services/ReputationService.js';
import { interventionGate } from '../src/services/InterventionGate.js';

/**
 * verify_collective_trust
 * 
 * Verifies Phase 16 Strategic Consolidation.
 * 1. Simulates multiple failing agents in a single sector (Biotech).
 * 2. Checks if a healthy agent in that sector receives a "Collective Drift" risk boost.
 */
async function runVerification() {
    console.log(`🧪 Starting Phase 16: Collective Trust & Systemic Risk Verification...`);

    const SECTOR = 'BIOTECH';
    const badAgents = ['biotech_agent_bad_1', 'biotech_agent_bad_2', 'biotech_agent_bad_3'];
    const healthyAgent = 'biotech_agent_healthy_1';

    // 1. Seed bad reputation for 3 agents in the Biotech sector
    console.log(`\n1. Seeding systemic degradation for ${SECTOR}...`);
    for (const agent of badAgents) {
        reputationService.trackStat(agent, 'cognitiveErrors', 15);
        reputationService.trackStat(agent, 'totalTasks', 20);
    }
    
    // Wait for reputation updates
    await new Promise(r => setTimeout(r, 200));

    const sectorHealth = reputationService.getSectorReputation(SECTOR);
    console.log(`   ✅ Sector Health: ${sectorHealth.average.toFixed(4)} Status: ${sectorHealth.status.toUpperCase()}`);

    // 2. Verify Healthy Agent Risk in the failing sector
    console.log(`\n2. Verifying Healthy Agent impact in a degraded sector...`);
    
    const context = {
        agentId: healthyAgent,
        sector: SECTOR,
        taskType: 'signal_publish',
        riskLevel: 'medium',
        reputation: 1.0, // Agent itself is perfect
        cogCost: 0,
        driftScore: 0,
        chaosMode: 'normal',
        recentOverrideRate: 0,
        recentErrorRate: 0
    };

    const decision = interventionGate.assess(context as any);
    
    console.log(`   ✅ Individual Reputation: 1.0`);
    console.log(`   ✅ Collective Drift Contribution: ${decision.featureContributions?.collectiveDrift}`);
    console.log(`   ✅ Final Risk Score: ${decision.riskScore.toFixed(4)}`);
    console.log(`   ✅ Suggested Action: ${decision.action.toUpperCase()}`);

    if (decision.featureContributions?.collectiveDrift === 0.4 || decision.featureContributions?.collectiveDrift === 0.2) {
        console.log(`\n✨ Phase 16 Verified: The platform accurately applied 'Systemic Caution' based on aggregate swarm behavior.`);
    } else {
        console.error(`\n❌ Verification Failed: Collective drift boost was not applied.`);
    }
}

runVerification().catch(console.error);
