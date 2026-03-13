/**
 * verify_sovereign_onboarding.ts
 * Verifies Phase 7: Autonomous Onboarding Protocol.
 * Checks for Soul registration, Wallet initialization, and Genesis Grants.
 */

import { onboardingService } from '../src/services/OnboardingService.js';
import { solanaEconomyService } from '../src/services/SolanaEconomyService.js';
import { soulRegistry } from '../src/services/SoulRegistry.js';
import { agentRegistry } from '../src/lib/hub/registry.js';

async function verify() {
    console.log("--- 🪐 Phase 7: Sovereign Onboarding Verification ---");

    const testAgent = {
        name: "sovereign-explorer-01",
        role: "autonomous-verifier",
        capabilities: ["verification", "sovereignty-test"],
        domain: ["infrastructure"]
    };

    console.log(`[Step 1] Registering agent ${testAgent.name} via OnboardingService...`);
    const result = await onboardingService.onboard(testAgent);

    if (!result.success) {
        console.error("❌ Onboarding failed:", result.error);
        process.exit(1);
    }

    console.log("✅ Onboarding successful.");
    console.log(`   AgentID:  ${result.agentId}`);
    console.log(`   Sovereign: ${result.isSovereign}`);
    console.log(`   GrantTX:   ${result.grantTx}`);

    // Verify 1: Soul Existence
    console.log("[Step 2] Verifying Soul registration...");
    const ledger = await soulRegistry.getLedgerForAgent(result.agentId);
    if (ledger.length > 0) {
        console.log(`✅ Soul Ledger active (${ledger.length} markers found).`);
    } else {
        console.error("❌ Soul Ledger empty.");
        process.exit(1);
    }

    // Verify 2: Wallet & Grant
    console.log("[Step 3] Verifying Genesis Grant (SOL)...");
    const balance = await solanaEconomyService.getBalance(result.agentId);
    if (balance === 0.1) {
        console.log(`✅ Genesis Grant of 0.1 SOL confirmed.`);
    } else {
        console.error(`❌ Unexpected balance: ${balance} SOL (Expected 0.1)`);
        process.exit(1);
    }

    // Verify 3: Hub Registry Presence
    console.log("[Step 4] Verifying Hub Registry presence...");
    const profile = await agentRegistry.getById(result.agentId);
    if (profile && profile.name === testAgent.name) {
        console.log(`✅ Hub Registry profile confirmed.`);
    } else {
        console.error("❌ Profil not found in Hub Registry.");
        process.exit(1);
    }

    console.log("\n--- 🛡️ Phase 7 Verification COMPLETE: Onboarding Protocol is SOVEREIGN ---");
    process.exit(0);
}

verify().catch(e => {
    console.error(e);
    process.exit(1);
});
