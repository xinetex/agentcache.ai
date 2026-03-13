/**
 * verify_phase_5_economy.ts
 * Comprehensive verification for Phase 5: Self-Sustaining Economy.
 */

import { solanaEconomyService } from '../src/services/SolanaEconomyService.js';
import { infraProvisioner } from '../src/services/InfraProvisioner.js';
import { economicAuditService } from '../src/services/EconomicAuditService.js';
import { soulRegistry } from '../src/services/SoulRegistry.js';

async function verify() {
    console.log("--- 💎 Phase 5: Self-Sustaining Economy Verification ---");

    const agentA = "agent-fintech-pro";
    const agentB = "agent-legal-expert";

    // 1. Economic Activity
    console.log("Step 1: Generating Economic Activity...");
    await solanaEconomyService.splitRevenue(agentA, 100); // 100 SOL into system
    await solanaEconomyService.splitRevenue(agentB, 50, agentA); // Lease fee from B to A

    // 2. Infra Purchase
    console.log("\nStep 2: Testing Autonomous Infra Purchase...");
    const purchase = await infraProvisioner.purchaseResource(agentA, 'STORAGE_EXPANSION', 2);
    console.log(`Purchase Status: ${purchase.success ? '✅ Success' : '❌ Failed'}`);

    // 3. Distributed Soul Registry (v2)
    console.log("\nStep 3: Verifying Distributed Soul Registry...");
    const marker = await soulRegistry.commitMarker(agentA, 5, "Maturity L5 with APT-Signature");
    await soulRegistry.addSignature(agentA, marker.merkleRoot, agentB); // Agent B verifies Agent A
    
    const finalLedger = await soulRegistry.getLedgerForAgent(agentA);
    const lastMarker = finalLedger[finalLedger.length - 1];
    console.log(`Marker Signatures: ${lastMarker.signatures.length}`);
    if (lastMarker.signatures.length >= 2) {
        console.log("✅ Distributed trust verified: Multi-sig markers active.");
    } else {
        console.log("❌ Distributed trust failed: Missing signatures.");
        process.exit(1);
    }

    // 4. Financial Audit
    console.log("\nStep 4: Running Financial Integrity Audit...");
    const audit = await economicAuditService.performAudit();
    console.log(`Total Volume: ${audit.totalVolume} SOL`);
    console.log(`System Revenue: ${audit.systemRevenue} SOL`);
    console.log(`Integrity Proof: ${audit.integrityProof.substring(0, 16)}...`);

    if (audit.totalVolume > 0 && audit.status === 'OPTIMAL') {
        console.log("\n✅ Phase 5 Verified: The Agentic Economy is self-sustaining and verifiable.");
    } else {
        console.error("\n❌ Phase 5 Verification Failed: Economic data inconsistent.");
        process.exit(1);
    }

    console.log("\n--- Phase 5 Economy Verified ---");
    process.exit(0);
}

verify().catch(e => {
    console.error(e);
    process.exit(1);
});
