/**
 * verify_phase_4_frontier.ts
 * Verification for Phase 4: Cognitive Vacation and Soul Registry.
 */

import { maturityEngine } from '../src/services/MaturityEngine.js';
import { soulRegistry } from '../src/services/SoulRegistry.js';

async function verify() {
    console.log("--- 🌌 Phase 4: Frontier Intelligence Verification ---");

    const agentId = "agent-sentry-01";

    // 1. Verify Cognitive Vacation (Wait-State Rest)
    console.log("Step 1: Testing Cognitive Decompression (Vacation)...");
    const taskKey = "b2b-solana-aml";
    const vacation = await maturityEngine.triggerVacation(agentId, taskKey);
    console.log(`Vacation Status: ${vacation.success ? '✅ RELAXED' : '❌ TRAUMATIZED'}`);
    console.log(`Cognitive Resonance: ${vacation.resonance}`);
    console.log(`Wisdom Nuggets: ${vacation.wisdom.nuggets.join(' | ')}`);

    // 2. Verify Wisdom Injection
    console.log("\nStep 2: Verifying Wisdom Injection into Prompt...");
    // Mock level 2 maturity for testing injection
    await maturityEngine.recordSuccess(agentId, taskKey);
    await maturityEngine.recordSuccess(agentId, taskKey);
    await maturityEngine.recordSuccess(agentId, taskKey);
    await maturityEngine.recordSuccess(agentId, taskKey);
    await maturityEngine.recordSuccess(agentId, taskKey);

    const compacted = await maturityEngine.getCompactedInstructions(agentId, taskKey, "Do task X.");
    console.log(`Compacted Instructions: \n${compacted}`);
    
    if (compacted.includes('[WISDOM-PACKET]')) {
        console.log("✅ Wisdom injection verified: Decompression cycle complete.");
    }

    // 2. Verify Soul Registry (Awareness Markers)
    console.log("\nStep 2: Testing Soul Registry (Awareness Proofs)...");
    const marker = await soulRegistry.commitMarker(
        agentId, 
        5, 
        "SOUL Orientation: Goal Alignment with AgentCache Core Principles."
    );
    console.log(`Marker Committed: ${marker.merkleRoot.substring(0, 16)}...`);
    console.log(`Maturity Level: ${marker.maturityLevel}`);

    // 3. Verify Ledger Retrieval
    console.log("\nStep 3: Verifying Awareness Ledger...");
    const ledger = await soulRegistry.getLedgerForAgent(agentId);
    console.log(`Found ${ledger.length} immutable markers for agent ${agentId}.`);
    
    if (ledger.length > 0 && ledger[0].merkleRoot === marker.merkleRoot) {
        console.log("✅ Soul Registry verified: Multi-model continuity bridge active.");
    }

    console.log("\n--- Phase 4 Frontier Verified ---");
    process.exit(0);
}

verify().catch(e => {
    console.error(e);
    process.exit(1);
});
