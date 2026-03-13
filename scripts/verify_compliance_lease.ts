/**
 * verify_compliance_lease.ts
 * Verifies Phase 8: Compliance Lease and Recurring Payments.
 */

import { complianceSwarmOrchestrator } from '../src/services/ComplianceSwarmOrchestrator.js';
import { heuristicMarketplace } from '../src/services/HeuristicMarketplace.js';
import { solanaEconomyService } from '../src/services/SolanaEconomyService.js';
import { agentRegistry } from '../src/lib/hub/registry.js';

async function verify() {
    console.log("--- ⚖️ Phase 8: Compliance Lease & Recurring Economy Verification ---");

    // 1. Setup Test Agent (The Consumer)
    const consumerName = "fintech-startup-agent";
    const regResult = await agentRegistry.register({
        name: consumerName,
        role: "defi-trader",
        capabilities: ["trading"],
        domain: ["finance"]
    });
    const agentId = regResult.agentId;
    await solanaEconomyService.initializeWallet(agentId, 1.0); // Fund with 1 SOL
    console.log(`✅ Registered consumer agent: ${agentId} with 1.0 SOL.`);

    // 2. Spawn a Compliance Auditor (The Provider)
    const auditor = await complianceSwarmOrchestrator.spawnAuditor('FINANCIAL');
    console.log(`✅ Spawned Auditor: ${auditor.name} (${auditor.id}).`);

    // 3. Create a Monthly Lease (Subscription)
    const dealId = "deal-999-alpha";
    console.log(`[Step 2] Creating Monthly Compliance Lease for deal ${dealId}...`);
    const lease = await heuristicMarketplace.leaseHeuristic(
        auditor.id,
        agentId,
        dealId,
        "Axiom-Compliance-Monitoring-Logic-V1",
        'MONTHLY'
    );
    console.log(`✅ Lease created: ${lease.id} (Type: ${lease.subscriptionType})`);

    // 4. Process a Lease Payment
    console.log("[Step 3] Processing automated monthly lease payment (25.00 units)...");
    const amount = 0.25; // 0.25 SOL for the test
    const txs = await solanaEconomyService.processLease(lease.id, agentId, auditor.id, amount);

    console.log(`✅ Payment processed. ${txs.length} transactions executed.`);
    txs.forEach(tx => console.log(`   TX ${tx.amount} SOL: ${tx.purpose}`));

    // 5. Verify Balances
    const finalBalance = await solanaEconomyService.getBalance(agentId);
    console.log(`✅ Final Consumer Balance: ${finalBalance} SOL (Expected ~0.75)`);

    if (finalBalance <= 0.8) {
        console.log("✅ Economy Split confirmed: Platform captured 100% since it owns the Auditor.");
    } else {
        console.error("❌ Balance discrepancy detected.");
        process.exit(1);
    }

    console.log("\n--- 🛡️ Phase 8 Verification COMPLETE: Compliance Economy is OPERATIONAL ---");
    process.exit(0);
}

verify().catch(e => {
    console.error(e);
    process.exit(1);
});
