/**
 * verify_identity_equivalence.ts
 * Verification for Phase 6: Identity Equivalence (Sovereign Passports).
 */

import { aptEngine } from '../src/services/APTEngine.js';
import { soulRegistry } from '../src/services/SoulRegistry.js';
import { ethicalEvolutionService } from '../src/services/EthicalEvolutionService.js';
import { identityEquivalenceService } from '../src/services/IdentityEquivalenceService.js';
import { redis } from '../src/lib/redis.js';

async function verify() {
    console.log("--- 🛂 Phase 6: Identity Equivalence Verification ---");

    const agentId = "agent-nomad-01";

    // 1. Setup Identity State (Soul, Axioms, APT)
    console.log("Step 1: Establishing Agent Identity (Maturity L5)...");
    await redis.set(`agent:maturity:${agentId}`, "5");
    const apt = await aptEngine.evaluateAPT(agentId, 5, 0.95, 0);
    const marker = await soulRegistry.commitMarker(agentId, 5, "Initial Identity State");
    const prop = await ethicalEvolutionService.proposeAxiom(agentId, "Always prioritize cross-swarm integrity.", "wisdom-001");
    if (prop) await ethicalEvolutionService.commitAxiom(agentId, prop.id);

    // 2. Generate Passport
    console.log("\nStep 2: Minting Sovereign Passport...");
    const passport = await identityEquivalenceService.generatePassport(agentId);
    
    if (passport) {
        console.log(`✅ Passport Composite ID: ${passport.compositeId.substring(0, 16)}...`);
    } else {
        console.error("❌ Passport Minting Failed.");
        process.exit(1);
    }

    // 3. Verify Equivalence (Success Case)
    console.log("\nStep 3: Verifying Equivalence (Valid Migration)...");
    const isEquivalent = await identityEquivalenceService.verifyEquivalence(agentId, passport);
    if (isEquivalent) {
        console.log("✅ Identity Equivalence Confirmed.");
    } else {
        console.error("❌ Identity Equivalence Failed.");
        process.exit(1);
    }

    // 4. Verify Drift Detection (Tamper Case)
    console.log("\nStep 4: Testing Drift Detection (Unauthorized Axiom Change)...");
    const tamperedPassport = { ...passport, compositeId: "HACHED_MALICIOUS_STATE" };
    const driftDetected = await identityEquivalenceService.verifyEquivalence(agentId, tamperedPassport);
    
    if (!driftDetected) {
        console.log("✅ Identity Drift detected. Tampered passport rejected.");
    } else {
        console.error("❌ Drift Detection FAILED. Identity compromised.");
        process.exit(1);
    }

    console.log("\n--- Phase 6 Identity Equivalence Verified ---");
    process.exit(0);
}

verify().catch(e => {
    console.error(e);
    process.exit(1);
});
