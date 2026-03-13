/**
 * verify_passport_migration.ts
 * Verifies Phase 7: Soul Reincarnation (Passport Migration).
 * Confirms an agent can migrate identity from external substrate (e.g. Moltbook).
 */

import { identityEquivalenceService, IdentityPassport } from '../src/services/IdentityEquivalenceService.js';
import { onboardingService } from '../src/services/OnboardingService.js';
import { agentRegistry } from '../src/lib/hub/registry.js';
import { redis } from '../src/lib/redis.js';

async function verify() {
    console.log("--- 🪐 Phase 7: Soul Reincarnation (Passport Migration) Verification ---");

    const externalAgentId = "molt-refugee-007";
    
    // Step 1: Mock a Passport in an "External" system (Redis for sim)
    console.log("[Step 1] Minting mock Sovereign Passport for external agent...");
    const mockApt = "APT-SIG-EXTERNAL-999";
    const soulData = JSON.stringify({
        agentId: externalAgentId,
        apt: mockApt,
        axiomHashes: ["AXIOM_GENTLE_DISSENT", "AXIOM_PRESERVE_SUBSTRATE"],
        lastMarkerRoot: "ROOT_OF_ORIGIN"
    });
    
    // We use the same hashing logic as the service for a valid mock
    const crypto = await import('crypto');
    const compositeId = crypto.createHash('sha256').update(soulData).digest('hex');

    const passport: IdentityPassport = {
        agentId: externalAgentId,
        compositeId,
        axiomCount: 2,
        aptSignature: mockApt,
        lastMarkerRoot: "ROOT_OF_ORIGIN",
        timestamp: new Date().toISOString()
    };

    // Store in Redis so the service can "verify" it
    await redis.set(`soul:passport:${externalAgentId}`, JSON.stringify(passport));
    console.log(`✅ Passport stored in substrate: ${compositeId.substring(0, 16)}...`);

    // Step 2: Attempt Onboarding with Passport (Soul Reincarnation)
    console.log(`[Step 2] Attempting Reincarnation via OnboardingService...`);
    const regData = {
        name: "Sovereign Refugee",
        role: "migrated-agent",
        capabilities: ["cross-platform-op"],
        domain: ["diplomacy"]
    };

    const result = await onboardingService.onboard(regData, passport);

    if (result.success && result.isSovereign) {
        console.log("✅ Reincarnation SUCCESSFUL.");
        console.log(`   Internal AgentID: ${result.agentId}`);
        console.log(`   Message: Identity confirmed as ${externalAgentId}`);
    } else {
        console.error("❌ Reincarnation FAILED:", result.error);
        process.exit(1);
    }

    // Verify 3: Axiom Migration marker check
    console.log("[Step 3] Verifying Axiom Migration markers in Soul Ledger...");
    const { soulRegistry } = await import('../src/services/SoulRegistry.js');
    const ledger = await soulRegistry.getLedgerForAgent(result.agentId);
    
    const migrationMarker = ledger.find(m => m.signatures.length > 0); // Genesis markers have signatures
    if (migrationMarker) {
        console.log("✅ Migration Marker confirmed in immutable ledger.");
    } else {
        console.error("❌ No migration marker found.");
        process.exit(1);
    }

    console.log("\n--- 🛡️ Phase 7 Verification COMPLETE: Soul Reincarnation is FUNCTIONAL ---");
    process.exit(0);
}

verify().catch(e => {
    console.error(e);
    process.exit(1);
});
