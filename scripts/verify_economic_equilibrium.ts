/**
 * verify_economic_equilibrium.ts
 * Verifies Phase 10: Double-Entry Conservation and settlement finality.
 */

import { solanaEconomyService } from '../src/services/SolanaEconomyService.js';
import { economicAuditService } from '../src/services/EconomicAuditService.js';
import { agentRegistry } from '../src/lib/hub/registry.js';
import { escrowService } from '../src/services/EscrowService.js';

async function verify() {
    console.log("--- ⚖️ Phase 10: Economic Equilibrium Verification ---");

    // 1. Initial Injection (Conservation Check)
    const agentA = (await agentRegistry.register({ name: "agent-a" })).agentId;
    const agentB = (await agentRegistry.register({ name: "agent-b" })).agentId;
    
    await solanaEconomyService.initializeWallet(agentA, 10.0);
    console.log(`✅ Injected 10.0 SOL into the substrate.`);

    const startEquilibrium = await solanaEconomyService.validateLedgerEquilibrium();
    console.log(`✅ Initial Equilibrium: ${startEquilibrium.balanced ? 'BALANCED' : 'FAILED'}`);

    // 2. High-Frequency Transfer Test (Double-Entry Leakage test)
    console.log("[Step 1] Running 50 internal transfers to test leakage...");
    for (let i = 0; i < 50; i++) {
        await solanaEconomyService.executeTransfer(agentA, `WALLET:${agentB}`, 0.1, `STRESS_TEST_${i}`);
        await solanaEconomyService.updateBalance(agentA, -0.1);
        await solanaEconomyService.updateBalance(agentB, 0.1);
    }

    const endEquilibrium = await solanaEconomyService.validateLedgerEquilibrium();
    if (!endEquilibrium.balanced) {
        console.error(`❌ Equilibrium Lost! Drift: ${endEquilibrium.drift}`);
        process.exit(1);
    }
    console.log("✅ Equilibrium Hardening confirmed: Zero SOL leakage detected after 50 transactions.");

    // 3. Asynchronous Settlement Finality Test
    console.log("[Step 2] Testing Asynchronous Settlement Finality...");
    const tx = await solanaEconomyService.executeTransfer(agentA, agentB, 1.0, "FINALITY_TEST");
    console.log(`✅ Transaction ${tx.txId.substring(0, 8)} status: ${tx.status}`);

    if (tx.status !== 'PENDING') {
        console.error("❌ Transaction should start in PENDING state.");
        process.exit(1);
    }

    // Confirm cycles
    for (let c = 1; c <= 3; c++) {
        const updated = await solanaEconomyService.confirmTransaction(tx.txId);
        console.log(`   Cycle ${c}: confirmations=${updated?.confirmations}, status=${updated?.status}`);
    }

    const finalTx = await solanaEconomyService.confirmTransaction(tx.txId);
    if (finalTx?.status !== 'CONFIRMED') {
        console.error("❌ Transaction failed to reach CONFIRMED state after 3 cycles.");
        process.exit(1);
    }
    console.log("✅ Finality Hardening confirmed: Transactions require confirmation cycles.");

    // 4. Audit Proof Integrity Test
    console.log("[Step 3] Running deep integrity audit...");
    const txs = await solanaEconomyService.getRecentTransactions();
    console.log(`🔍 Internal check: ${txs.length} transactions found in ledger.`);

    const audit = await economicAuditService.performAudit();
    console.log(`✅ Audit Status: ${audit.status}`);
    console.log(`✅ Verified Proofs: ${audit.validProofCount}`);
    
    if (audit.status === 'OPTIMAL' && audit.validProofCount >= 50) {
        console.log("✅ Audit Integrity confirmed: All Phase 9/10 proofs verified.");
    } else {
        console.error("❌ Audit failure.");
        process.exit(1);
    }

    console.log("\n--- 🛡️ Phase 10 Verification (Economy) COMPLETE ---");
    process.exit(0);
}

verify().catch(e => {
    console.error(e);
    process.exit(1);
});
