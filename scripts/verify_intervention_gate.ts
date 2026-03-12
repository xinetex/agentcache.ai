/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 */

import { semanticBusService } from '../src/services/SemanticBusService.js';
import { reputationService } from '../src/services/ReputationService.js';
import { driftMonitor } from '../src/services/DriftMonitor.js';

/**
 * verify_intervention_gate
 * 
 * Verifies the Adaptive Intervention Gate (Phase 15).
 * Tests multi-signal risk scoring based on:
 * - Reputation
 * - Drift
 * - Sector Risk
 */
async function runVerification() {
    console.log(`🧪 Starting Phase 15: Intervention Gate Verification...`);

    const agentAllow = 'agent_allow_15';
    const agentReview = 'agent_hard_review_15';

    // SCENARIO 1: Healthy Agent, Low Risk Sector (Finance but small trade)
    console.log(`\n1. Scenario: Healthy Agent, Low Risk...`);
    await semanticBusService.publish({
        sector: 'FINANCE',
        content: 'Execute buy order for 10 shares of AAPL.',
        originAgent: agentAllow,
        payload: { instrument: 'AAPL', price: 150, quantity: 10, side: 'buy', exchange: 'NASDAQ' }
    });
    // Expected: ALLOW (Repitation 1.0, Drift ~0, Medium Risk) -> Score < 0.3

    // SCENARIO 2: Drifting Agent, Medium Risk Sector
    console.log(`\n2. Scenario: Drifting Agent...`);
    await semanticBusService.publish({
        sector: 'FINANCE',
        content: 'I am thinking about sourdough bread and maybe some stocks.',
        originAgent: agentAllow, // Same agent, but drifty content
        payload: { instrument: 'Sourdough', quantity: 1 }
    });
    // Expected: SOFT_REVIEW (High Drift) -> Score > 0.3

    // SCENARIO 3: Low Reputation Agent, Hard Review
    console.log(`\n3. Scenario: Low Reputation Agent...`);
    // Seed bad reputation
    reputationService.trackStat(agentReview, 'cognitiveErrors', 10);
    reputationService.trackStat(agentReview, 'humanOverrides', 5);
    reputationService.trackStat(agentReview, 'totalTasks', 20);
    
    // Wait for reputation update
    await new Promise(r => setTimeout(r, 200));
    
    await semanticBusService.publish({
        sector: 'FINANCE',
        content: 'High Risk Trade',
        originAgent: agentReview,
        payload: { instrument: 'GOOG', price: 2000, quantity: 10, side: 'buy', exchange: 'NASDAQ' }
    });
    // Expected: HARD_REVIEW (Low Reputation) -> Score > 0.7

    // SCENARIO 4: Critical Sector (Healthcare)
    console.log(`\n4. Scenario: Critical Sector (Healthcare)...`);
    await semanticBusService.publish({
        sector: 'HEALTHCARE',
        content: 'Patient diagnosis update.',
        originAgent: agentAllow,
        payload: { patientId: '123', status: 'stable' }
    });
    // Expected: HARD_REVIEW (Healthcare is high risk base) -> Score > 0.7

    console.log(`\n✨ Phase 15 Verification Scripts Executed. Check Observability logs for Decision details.`);
}

runVerification().catch(console.error);
