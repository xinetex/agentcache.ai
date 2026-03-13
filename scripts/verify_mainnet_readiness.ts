/**
 * verify_mainnet_readiness.ts
 * Verifies Phase 11: Nonce Replay Protection, Dynamic Fees, and Deep Reconciliation.
 */

import { solanaEconomyService } from '../src/services/SolanaEconomyService.js';
import { economicAuditService } from '../src/services/EconomicAuditService.js';
import { agentRegistry } from '../src/lib/hub/registry.js';
import { redis } from '../src/lib/redis.js';

async function verify() {
    console.log("--- 🚀 Phase 11: Mainnet Readiness Verification ---");

    // Clear ledger for clean run
    await redis.del('economy:ledger');
    await redis.del('economy:ledger-integrity');

    const agentX = (await agentRegistry.register({ name: "mainnet-agent-x" })).agentId;
    await solanaEconomyService.initializeWallet(agentX, 5.0);
    console.log(`✅ Agent X initialized with 5.0 SOL.`);

    // 1. Nonce & Replay Protection
    console.log("[Step 1] Testing Nonce & Replay Protection...");
    const currentNonce = await solanaEconomyService.getNonce(agentX);
    
    // Successful transfer with correct nonce
    await solanaEconomyService.executeTransfer(agentX, "VENDOR_Y", 0.5, "LEGIT_TX", currentNonce);
    console.log(`✅ Step 1.1: Legitimate TX accepted with Nonce ${currentNonce}.`);

    // Attempt replay with SAME nonce
    try {
        await solanaEconomyService.executeTransfer(agentX, "VENDOR_Y", 1.0, "REPLAY_ATTACK", currentNonce);
        console.error("❌ Step 1.2: Replay attack with duplicate nonce should have failed!");
        process.exit(1);
    } catch (e: any) {
        console.log(`✅ Step 1.2: Replay attack REJECTED (${e.message}).`);
    }

    // Attempt with FUTURE nonce
    try {
        await solanaEconomyService.executeTransfer(agentX, "VENDOR_Y", 1.0, "OUT_OF_ORDER", currentNonce + 10);
        process.exit(1);
    } catch (e: any) {
        console.log(`✅ Step 1.3: Out-of-order nonce REJECTED.`);
    }

    // 2. Dynamic Fee Model
    console.log("[Step 2] Testing Dynamic Fee Model...");
    const beforeBalance = await solanaEconomyService.getBalance(agentX);
    const amount = 1.0;
    const expectedFee = await solanaEconomyService.calculateNetworkFee("STANDARD_TX");
    
    await solanaEconomyService.executeTransfer(agentX, "TREASURY", amount, "STANDARD_TX", currentNonce + 1);
    await solanaEconomyService.updateBalance(agentX, -amount);
    
    const afterBalance = await solanaEconomyService.getBalance(agentX);
    const actualDeduction = parseFloat((beforeBalance - afterBalance).toFixed(6));
    const expectedTotalDeduction = parseFloat((amount + expectedFee).toFixed(6));

    if (actualDeduction === expectedTotalDeduction) {
        console.log(`✅ Dynamic Fee deducted: ${expectedFee} SOL. Total Deduction: ${actualDeduction} SOL.`);
    } else {
        console.error(`❌ Fee deduction mismatch. Expected ${expectedTotalDeduction}, got ${actualDeduction}.`);
        process.exit(1);
    }

    // 3. Deep Reconciliation Engine
    console.log("[Step 3] Testing Deep Reconciliation...");
    
    // Checkpoint 1
    const scan1 = await economicAuditService.reconcileGenesisToPresent(true);
    console.log(`✅ Initial Checkpoint: ${scan1.status} (Vol: ${scan1.historicalVolume.toFixed(2)} SOL)`);

    // Tamper with ledger BACKWARDS (modify the same ledger state we just hashed)
    const txs = await solanaEconomyService.getRecentTransactions();
    const targetTx = txs[1];
    const originalAmount = targetTx.amount;
    targetTx.amount = 999.0; // ILLEGAL MODIFICATION
    await redis.set(`tx:${targetTx.txId}`, JSON.stringify(targetTx));
    console.log(`⚠️  TAMPERING with transaction: ${targetTx.txId.substring(0,8)}...`);

    const scan2 = await economicAuditService.reconcileGenesisToPresent();
    if (scan2.status === 'MISMATCH') {
        console.log("✅ Reconciliation Engine DETECTED ledger tampering!");
    } else {
        console.error("❌ Reconciliation Engine FAILED to detect tampering.");
        process.exit(1);
    }

    // Restore and verify it matches again
    targetTx.amount = originalAmount;
    await redis.set(`tx:${targetTx.txId}`, JSON.stringify(targetTx));
    const scan3 = await economicAuditService.reconcileGenesisToPresent();
    console.log(`✅ Restoration Check: ${scan3.status} (MATCH expected)`);

    if (scan3.status !== 'MATCH') {
        console.error("❌ Reconciliation failed after restoration.");
        process.exit(1);
    }

    console.log("\n--- 🛡️ Phase 11 Verification (Mainnet) COMPLETE ---");
    process.exit(0);
}

verify().catch(e => {
    console.error(e);
    process.exit(1);
});
