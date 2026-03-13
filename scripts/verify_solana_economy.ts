/**
 * verify_solana_economy.ts
 * Verification for Phase 5: Solana Economy Service.
 */

import { solanaEconomyService } from '../src/services/SolanaEconomyService.js';

async function verify() {
    console.log("--- 💸 Phase 5: Solana Economy Verification ---");

    const agentId = "agent-fintech-pro";
    const providerAgentId = "agent-archon-01";
    const revenueAmount = 100; // SOL

    // 1. Verify Revenue Split (With Provider)
    console.log(`Step 1: Testing Revenue Split (${revenueAmount} SOL)...`);
    const transactions = await solanaEconomyService.splitRevenue(agentId, revenueAmount, providerAgentId);
    
    console.log(`Transactions Executed: ${transactions.length}`);
    transactions.forEach(tx => {
        console.log(`- [${tx.purpose}] ${tx.amount} SOL -> ${tx.toWallet}`);
    });

    // 2. Verify Balances
    console.log("\nStep 2: Verifying Agent Balances...");
    const agentBalance = await solanaEconomyService.getBalance(agentId);
    const providerBalance = await solanaEconomyService.getBalance(providerAgentId);
    
    console.log(`Agent ${agentId} Balance: ${agentBalance} SOL`);
    console.log(`Provider ${providerAgentId} Balance: ${providerBalance} SOL`);

    if (agentBalance === 10 && providerBalance === 70) {
        console.log("\n✅ Solana Economy verified: Fee splitting and balance management active.");
    } else {
        console.error("\n❌ Solana Economy failed: Balance calculations incorrect.");
        process.exit(1);
    }

    // 3. Verify Ledger Retrieval
    console.log("\nStep 3: Verifying Economy Ledger...");
    const ledger = await solanaEconomyService.getRecentTransactions();
    console.log(`Found ${ledger.length} transactions in the distributed ledger.`);

    console.log("\n--- Solana Economy Verified ---");
    process.exit(0);
}

verify().catch(e => {
    console.error(e);
    process.exit(1);
});
