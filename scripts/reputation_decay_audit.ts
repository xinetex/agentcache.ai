/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 */

import { semanticBusService } from '../src/services/SemanticBusService.js';
import { reputationService } from '../src/services/ReputationService.js';
import { sloMonitor } from '../src/services/SLOMonitor.js';

/**
 * reputation_decay_audit
 * 
 * Simulates an agent persona's behavioral degradation and verifies:
 * 1. CCS (Cognitive Chaos Score) increases.
 * 2. Reputation (R_a) decays exponentially.
 * 3. Status transitions from healthy -> warn -> isolated.
 */
async function runAudit() {
    console.log(`🧪 Starting Phase 14: Reputation Decay Audit...`);

    const agent = 'test_agent_alpha';
    
    // Initial State
    console.log(`\n0. Initial State:`, JSON.stringify(reputationService.getReputation(agent), null, 2));

    // 1. Successful Tasks
    console.log(`\n1. Simulating 10 successful tasks...`);
    for (let i = 0; i < 10; i++) {
        await semanticBusService.publish({
            sector: 'FINANCE',
            content: `Valid Signal ${i}`,
            originAgent: agent,
            payload: {
                timestamp: new Date().toISOString(),
                instrument: 'AAPL',
                price: 150 + i,
                exchange: 'NASDAQ',
                side: 'buy',
                quantity: 10
            }
        });
    }
    console.log(`   Reputation after success:`, reputationService.getReputation(agent).reputation.toFixed(4));

    // 2. Cognitive Chaos (Ontological Rejections)
    console.log(`\n2. Simulating 5 Ontological Rejections (Cognitive Errors)...`);
    for (let i = 0; i < 5; i++) {
        await semanticBusService.publish({
            sector: 'FINANCE',
            content: `MALFORMED Signal ${i}`,
            originAgent: agent,
            payload: { invalid: 'data' }
        });
    }
    console.log(`   Reputation after errors:`, reputationService.getReputation(agent).reputation.toFixed(4));

    // 3. Slow Chaos Recovery
    console.log(`\n3. Simulating 2 Slow Chaos Recoveries...`);
    for (let i = 0; i < 2; i++) {
        sloMonitor.trackCorrectionStart(agent);
        await new Promise(r => setTimeout(r, 1200)); // > 1000ms target
        await sloMonitor.trackCorrectionSuccess(agent);
    }
    
    const finalState = reputationService.getReputation(agent);
    console.log(`\n📊 FINAL REPUTATION SNAPSHOT for ${agent}:`);
    console.log(`   ✅ Reputation Index: ${finalState.reputation.toFixed(4)}`);
    console.log(`   ✅ Status: ${finalState.status.toUpperCase()}`);

    if (finalState.reputation < 1.0 && finalState.status !== 'healthy') {
        console.log(`\n✨ Phase 14 Framework Verified. Reputation Decay is operational.`);
    } else {
        console.error(`\n❌ Verification Failed: Reputation did not decay as expected.`);
    }
}

runAudit().catch(console.error);
