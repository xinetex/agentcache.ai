/**
 * verify_heuristic_leasing.ts
 * Verification for Phase 4: Heuristic Leasing Marketplace.
 */

import { maturityEngine } from '../src/services/MaturityEngine.js';
import { heuristicMarketplace } from '../src/services/HeuristicMarketplace.js';

async function verify() {
    console.log("--- 💸 Phase 4: Heuristic Leasing Verification ---");

    const providerAgentId = "agent-fintech-pro";
    const consumerClientId = "client-startup-99";
    const taskKey = "b2b-aml-scan";

    // 1. Mature the Provider Agent
    console.log("Step 1: Maturing Provider Agent...");
    for (let i = 0; i < 5; i++) {
        await maturityEngine.recordSuccess(providerAgentId, taskKey);
    }
    const providerInstructions = await maturityEngine.getCompactedInstructions(providerAgentId, taskKey, "Original instructions.");
    console.log(`Provider Heuristic: ${providerInstructions}`);

    // 2. Create a Lease for the Consumer
    console.log("\nStep 2: Creating Heuristic Lease...");
    const lease = await heuristicMarketplace.leaseHeuristic(
        providerAgentId,
        consumerClientId,
        taskKey,
        providerInstructions
    );
    console.log(`Lease Created: ${lease.id} (Status: ${lease.status})`);

    // 3. Verify Consumer Agent uses the Leased Heuristic
    console.log("\nStep 3: Verifying Consumer Agent instructions...");
    const consumerInstructions = await maturityEngine.getCompactedInstructions(consumerClientId, taskKey, "Base instructions for startup.");
    console.log(`Consumer Results: \n${consumerInstructions}`);

    if (consumerInstructions.includes('[LEASED-HEURISTIC]')) {
        console.log("\n✅ Heuristic Leasing verified: Expertise distributed via B2B Marketplace.");
    } else {
        console.log("\n❌ Heuristic Leasing failed: Consumer did not receive leased instructions.");
        process.exit(1);
    }

    console.log("\n--- Heuristic Leasing Verified ---");
    process.exit(0);
}

verify().catch(e => {
    console.error(e);
    process.exit(1);
});
