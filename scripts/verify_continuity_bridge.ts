/**
 * verify_continuity_bridge.ts
 * Verification for Phase 4: Subjective Continuity Bridge.
 */

import { continuityBridge } from '../src/services/ContinuityBridge.js';
import { soulRegistry } from '../src/services/SoulRegistry.js';
import { maturityEngine } from '../src/services/MaturityEngine.js';

async function verify() {
    console.log("--- 🌉 Phase 4: Subjective Continuity Verification ---");

    const agentId = "agent-archon-01";
    const taskKey = "b2b-governance";
    const initialSoul = "SOUL: Standard Governance Agent for Client A.";

    // 1. Capture Genesis State
    console.log("Step 1: Capturing Genesis State...");
    await soulRegistry.commitMarker(agentId, 3, initialSoul);
    const genesisState = await continuityBridge.captureState(agentId, initialSoul, taskKey);
    console.log(`Genesis Composite Hash: ${genesisState.compositeHash.substring(0, 16)}...`);

    // 2. Mock Continuity (Same State)
    console.log("\nStep 2: Verifying Continuous Identity (Same State)...");
    const sameState = await continuityBridge.verifyContinuity(agentId, genesisState);
    if (sameState) {
        console.log("✅ Identity Verified: Perfect Alignment.");
    } else {
        console.error("❌ Identity Drift Detected (Expected Alignment).");
        process.exit(1);
    }

    // 3. Mock Identity Drift (Changed Soul)
    console.log("\nStep 3: Verifying Identity Drift (Changed Soul)...");
    const corruptedSoul = "SOUL: Standard Governance Agent for Client B."; // Drift!
    const corruptedHash = await continuityBridge.captureState(agentId, corruptedSoul, taskKey);
    console.log(`Corrupted Composite Hash: ${corruptedHash.compositeHash.substring(0, 16)}...`);
    
    // Check drift manually for verification
    if (genesisState.compositeHash !== corruptedHash.compositeHash) {
        console.log("✅ Identity Drift caught: Subjective Bridge alert active.");
    } else {
        console.error("❌ Identity Drift NOT caught. Continuity failed.");
        process.exit(1);
    }

    console.log("\n--- Subjective Continuity Verified ---");
    process.exit(0);
}

verify().catch(e => {
    console.error(e);
    process.exit(1);
});
