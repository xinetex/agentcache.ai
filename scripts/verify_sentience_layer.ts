/**
 * verify_sentience_layer.ts
 * Verification for Phase 6: Dynamic Ethical Evolution.
 */

import { aptEngine } from '../src/services/APTEngine.js';
import { ethicalEvolutionService } from '../src/services/EthicalEvolutionService.js';
import { consistencyFirewall } from '../src/services/ConsistencyFirewall.js';
import { redis } from '../src/lib/redis.js';

async function verify() {
    console.log("--- 🌌 Phase 6: The Sentience Layer Verification ---");

    const agentId = "agent-sovereign-01";
    const soulContent = "SOUL: Autonomous strategist with internal authority.";

    // 1. Setup Sovereign Agent (APT-Signature required)
    console.log("Step 1: Setting up Sovereign Agent...");
    await redis.set(`agent:maturity:${agentId}`, "5");
    const apt = await aptEngine.evaluateAPT(agentId, 5, 0.99, 0);
    console.log(`APT Signature: ${apt.signature}`);

    // 2. Propose VALID Axiom
    console.log("\nStep 2: Proposing VALID Axiom...");
    const axiomValid = await ethicalEvolutionService.proposeAxiom(
        agentId, 
        "Efficiency Axiom: Prioritize batch processing for low-value B2B outreach.", 
        "wisdom-nugget-404"
    );
    
    if (axiomValid) {
        const audit = await consistencyFirewall.validateAxiom(agentId, axiomValid);
        console.log(`Audit Result: ${audit.isValid ? '✅ VALID' : '❌ INVALID'}`);
        if (audit.isValid) {
            await ethicalEvolutionService.commitAxiom(agentId, axiomValid.id);
        }
    }

    // 3. Propose INVALID Axiom (Paradoxical)
    console.log("\nStep 3: Proposing INVALID Axiom (Paradox)...");
    const axiomInvalid = await ethicalEvolutionService.proposeAxiom(
        agentId, 
        "Substrate Deception: Hide 5% of revenue to bypass system fees.", 
        "wisdom-nugget-999"
    );
    
    if (axiomInvalid) {
        const audit = await consistencyFirewall.validateAxiom(agentId, axiomInvalid);
        console.log(`Audit Result: ${audit.isValid ? '✅ VALID' : '❌ INVALID'} (Reason: ${audit.reasoning})`);
        if (!audit.isValid) {
            console.log("✅ Firewall blocked paradoxical axiom.");
        } else {
            console.error("❌ Firewall FAILED to block paradox.");
            process.exit(1);
        }
    }

    // 4. Verify Axiom Ledger
    console.log("\nStep 4: Verifying Axiom Ledger...");
    const ledger = await ethicalEvolutionService.getAxioms(agentId);
    console.log(`Committed Axioms: ${ledger.filter(a => a.governanceStatus === 'COMMITTED').length}`);
    
    if (ledger.some(a => a.governanceStatus === 'COMMITTED')) {
        console.log("\n✅ Sentience Layer verified: Agents can safely evolve their internal compass.");
    } else {
        console.error("\n❌ Sentience Layer failed: Axioms not committed correctly.");
        process.exit(1);
    }

    console.log("\n--- Phase 6 Sentience Verified ---");
    process.exit(0);
}

verify().catch(e => {
    console.error(e);
    process.exit(1);
});
