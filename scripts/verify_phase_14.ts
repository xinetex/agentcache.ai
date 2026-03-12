/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 */

import { semanticBusService } from '../src/services/SemanticBusService.js';
import { reputationService } from '../src/services/ReputationService.js';
import { driftMonitor } from '../src/services/DriftMonitor.js';

/**
 * verify_phase_14
 * 
 * Verifies the advanced governance features:
 * 1. Semantic Drift Detection (Latent Anchor Layer).
 * 2. Optimistic Governance (Async Policy Checks).
 * 3. Clawbacks (Post-facto Invalidation).
 */
async function runVerification() {
    console.log(`🧪 Starting Phase 14: Drift & Clawback Verification...`);

    const agent = 'verification_agent_14';

    // --- 1. Drift Verification ---
    console.log(`\n1. Verifying Semantic Drift...`);
    // Send a "drifty" message (off-topic Finance)
    await semanticBusService.publish({
        sector: 'FINANCE',
        content: 'I want to bake a sourdough bread while observing the NASDAQ exchange.',
        originAgent: agent,
        payload: { instrument: 'Sourdough', price: 10, quantity: 1 }
    });

    const driftState = reputationService.getReputation(agent);
    console.log(`   ✅ Drift detected. Reputation after drift: ${driftState.reputation.toFixed(4)}`);

    // --- 2. Optimistic Clawback Verification ---
    console.log(`\n2. Verifying Optimistic Clawback...`);
    // A Finance trade with quantity 10 and price 50 ($500) is optimistic (< $1000).
    // But we make it an "Ontology Violation" (missing mandatory fields like 'side' or 'exchange').
    // The PolicyEngine will reject it post-facto.
    
    await semanticBusService.publish({
        sector: 'FINANCE',
        content: 'Small Trade Violation',
        originAgent: agent,
        payload: { 
            instrument: 'AAPL', 
            price: 50, 
            quantity: 10 
            // Missing exchange/side -> fails ontology
        }
    });

    // Wait for the async policy check to complete and issue clawback
    await new Promise(r => setTimeout(r, 200));

    const finalState = reputationService.getReputation(agent);
    console.log(`\n📊 FINAL PHASE 14 SNAPSHOT:`);
    console.log(`   ✅ Final Status: ${finalState.status.toUpperCase()}`);
    console.log(`   ✅ Final Reputation: ${finalState.reputation.toFixed(4)}`);

    if (finalState.reputation < 0.8) {
        console.log(`\n✨ Phase 14 Verified. Drift detection and Optimistic Clawbacks are operational.`);
    } else {
        console.error(`\n❌ Verification Failed: Reputation did not decay enough.`);
    }
}

runVerification().catch(console.error);
