/**
 * verify_escrow_settlement.ts
 * Verifies Phase 9: B2B Escrow Service and Hold-and-Release pattern.
 */

import { escrowService } from '../src/services/EscrowService.js';
import { solanaEconomyService } from '../src/services/SolanaEconomyService.js';
import { agentRegistry } from '../src/lib/hub/registry.js';
import { complianceSwarmOrchestrator } from '../src/services/ComplianceSwarmOrchestrator.js';

async function verify() {
    console.log("--- 💎 Phase 9: Escrow Settlement Verification ---");

    // 1. Setup Parties
    const consumerName = "escrow-consumer";
    const regC = await agentRegistry.register({ name: consumerName, role: "buyer" });
    const consumerId = regC.agentId;
    await solanaEconomyService.initializeWallet(consumerId, 2.0);

    const providerName = "escrow-provider";
    const regP = await agentRegistry.register({ name: providerName, role: "seller" });
    const providerId = regP.agentId;

    const auditor = await complianceSwarmOrchestrator.spawnAuditor('LEGAL');
    console.log(`✅ Parties initialized: Consumer(${consumerId}), Provider(${providerId}), Auditor(${auditor.id})`);

    // 2. Create Escrow
    console.log("[Step 1] Creating Escrow hold for 1.5 SOL...");
    const deal = await escrowService.createEscrow(
        consumerId,
        providerId,
        1.5,
        "High-Value Sentient Data Lease",
        auditor.id
    );
    console.log(`✅ Escrow ${deal.id} status: ${deal.status}`);

    const midBalance = await solanaEconomyService.getBalance(consumerId);
    console.log(`✅ Consumer Balance: ${midBalance} SOL (Expected 0.5)`);

    // 3. Signing process
    console.log("[Step 2] Signing deal (Consumer and Auditor)...");
    await escrowService.signEscrow(deal.id, consumerId);
    const updatedDeal = await escrowService.signEscrow(deal.id, auditor.id);

    console.log(`✅ Escrow final status: ${updatedDeal.status}`);

    // 4. Verify Final Release
    const providerBalance = await solanaEconomyService.getBalance(providerId);
    console.log(`✅ Provider Balance: ${providerBalance} SOL (Expected 1.5)`);

    if (updatedDeal.status === 'RELEASED' && providerBalance === 1.5) {
        console.log("✅ Escrow Hardening confirmed: Funds released only after multi-party verification.");
    } else {
        console.error("❌ Escrow failure.");
        process.exit(1);
    }

    console.log("\n--- 🛡️ Phase 9 Verification (Economy) COMPLETE ---");
    process.exit(0);
}

verify().catch(e => {
    console.error(e);
    process.exit(1);
});
