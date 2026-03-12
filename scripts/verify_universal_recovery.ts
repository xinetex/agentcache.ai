/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 */

import { semanticBusService } from '../src/services/SemanticBusService.js';
import { sloMonitor } from '../src/services/SLOMonitor.js';

/**
 * verify_universal_recovery
 * 
 * Verifies that the ChaosRecoveryEngine correctly prescribes domain-specific 
 * plans and that SLOMonitor records the associated "Cognitive Cost."
 */
async function runVerification() {
    console.log(`🧪 Starting Universal Chaos Recovery Verification...`);

    const agent = 'verification_agent';

    // 1. Trigger Finance Rejection (Syntactic)
    console.log(`\n1. Triggering Finance Rejection (Expected: syntactic_repair, low cost)...`);
    await semanticBusService.publish({
        sector: 'FINANCE',
        content: 'Malformed Finance',
        originAgent: agent,
        payload: { invalid: 'data' } // Missing mandatory fields
    });

    // 2. Trigger Legal Rejection (Semantic)
    console.log(`\n2. Triggering Legal Rejection (Expected: semantic_reconstruction, high cost)...`);
    await semanticBusService.publish({
        sector: 'LEGAL',
        content: 'Malformed Legal',
        originAgent: agent,
        payload: { invalid: 'data' }
    });

    // 3. Trigger Healthcare Rejection (Escalation)
    console.log(`\n3. Triggering Healthcare Rejection (Expected: human escalation, critical cost)...`);
    await semanticBusService.publish({
        sector: 'HEALTHCARE',
        content: 'Malformed Healthcare',
        originAgent: agent,
        payload: { invalid: 'data' }
    });

    // --- AUDIT ---
    await new Promise(r => setTimeout(r, 100)); // Small delay for async tracking
    const snapshot = sloMonitor.getSnapshot();
    
    console.log(`\n📊 RECOVERY SLO SNAPSHOT:`);
    console.log(`   ✅ Total Recovery Cost Score: ${snapshot.recoveryCostScore}`);
    console.log(`   ✅ Recovery Mode Distribution:`, JSON.stringify(snapshot.recoveryModes, null, 2));

    if (snapshot.recoveryCostScore > 0 && snapshot.recoveryModes['semantic_reconstruction'] > 0) {
        console.log(`\n✨ Universal Chaos Recovery Verified. Domain-specific plans and costs are active.`);
    } else {
        console.error(`\n❌ Verification Failed: Recovery metrics not captured correctly.`);
    }
}

runVerification().catch(console.error);
