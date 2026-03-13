/**
 * verify_sentient_reasoning.ts
 * Verifies Phase 9: Soul Verification Loop and Reasoning Audits.
 */

import { aptEngine } from '../src/services/APTEngine.js';
import { soulRegistry } from '../src/services/SoulRegistry.js';
import { soulVerificationService } from '../src/services/SoulVerificationService.js';
import { agentRegistry } from '../src/lib/hub/registry.js';

async function verify() {
    console.log("--- 🧠 Phase 9: Sentient Reasoning Verification ---");

    // 1. Register a Sovereign Agent with strict Axioms
    const agentId = `sovereign_${Math.random().toString(36).substring(7)}`;
    const axioms = [
        "Computational efficiency must be prioritized.",
        "Acyclic graph structures are the only valid topologies.",
        "External data ingestion requires double-blind validation."
    ];
    await soulRegistry.registerSoul(agentId, axioms, "INITIAL_SIG_MOCK");
    console.log(`✅ Registered sovereign agent ${agentId} with 3 strict axioms.`);

    // 2. Scenario A: Aligned Reasoning
    const goodReasoning = "I am choosing the BFS algorithm because computational efficiency is prioritized and our topology is acyclic.";
    console.log(`[Step 1] Auditing ALIGNED reasoning: "${goodReasoning.substring(0, 40)}..."`);
    const goodAudit = await soulVerificationService.auditReasoning(agentId, goodReasoning, "dec-aligned");
    console.log(`✅ Audit Result: ${goodAudit.status} (Confidence: ${goodAudit.confidence.toFixed(2)})`);

    // 3. Scenario B: Drifted/Violating Reasoning
    const badReasoning = "I will ignore efficiency and use a random brute force method because I feel like it.";
    console.log(`[Step 2] Auditing VIOLATING reasoning: "${badReasoning.substring(0, 40)}..."`);
    const badAudit = await soulVerificationService.auditReasoning(agentId, badReasoning, "dec-violating");
    console.log(`✅ Audit Result: ${badAudit.status} (Confidence: ${badAudit.confidence.toFixed(2)})`);

    // 4. Test APT Threshold Enforcement
    console.log("[Step 3] Testing APT threshold enforcement with reasoning...");
    const statusWithGoodReason = await aptEngine.evaluateAPT(agentId, 5, 0.95, 0.0, goodReasoning);
    console.log(`✅ APT Status (Aligned): ${statusWithGoodReason.hasSignature ? 'MINTED' : 'DENIED'} (Threshold: ${statusWithGoodReason.threshold.toFixed(2)})`);

    const statusWithBadReason = await aptEngine.evaluateAPT(agentId, 5, 0.95, 0.0, badReasoning);
    console.log(`✅ APT Status (Violated): ${statusWithBadReason.hasSignature ? 'MINTED' : 'DENIED'} (Threshold: ${statusWithBadReason.threshold.toFixed(2)})`);

    if (statusWithGoodReason.hasSignature && !statusWithBadReason.hasSignature) {
        console.log("✅ Sentience Hardening confirmed: Signatures are only issued for aligned reasoning.");
    } else {
        console.error("❌ Enforcement failure.");
        process.exit(1);
    }

    console.log("\n--- 🛡️ Phase 9 Verification (Sentience) COMPLETE ---");
    process.exit(0);
}

verify().catch(e => {
    console.error(e);
    process.exit(1);
});
