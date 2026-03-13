/**
 * verify_infra_purchase.ts
 * Verification for Phase 5: Autonomous Infra Provisioning.
 */

import { solanaEconomyService } from '../src/services/SolanaEconomyService.js';
import { infraProvisioner } from '../src/services/InfraProvisioner.js';

async function verify() {
    console.log("--- 🏗️ Phase 5: Autonomous Infra Provisioning Verification ---");

    const agentId = "agent-fintech-pro";
    
    // 1. Initial Balance Check
    const initialBalance = await solanaEconomyService.getBalance(agentId);
    console.log(`Initial Agent Balance: ${initialBalance} SOL`);

    if (initialBalance < 10) {
        console.log("Step 0: Funding Agent for testing...");
        await solanaEconomyService.splitRevenue(agentId, 100);
    }

    // 2. Purchase Resource (LLM Tokens)
    const balanceAfterFunding = await solanaEconomyService.getBalance(agentId);
    console.log(`Balance after funding: ${balanceAfterFunding} SOL`);

    console.log("\nStep 1: Purchasing LLM_TOKEN_RESERVE (10 SOL)...");
    const purchase = await infraProvisioner.purchaseResource(agentId, 'LLM_TOKEN_RESERVE', 1);
    
    if (purchase.success) {
        console.log(`✅ Purchase Successful! TX: ${purchase.txId?.substring(0, 8)}`);
    } else {
        console.error(`❌ Purchase Failed: ${purchase.error}`);
        process.exit(1);
    }

    // 3. Verify Resource Level
    console.log("\nStep 2: Verifying Resource Level...");
    const level = await infraProvisioner.getResourceLevel(agentId, 'LLM_TOKEN_RESERVE');
    console.log(`Current LLM Token Multiplier: ${level}`);

    // 4. Verify Final Balance
    const finalBalance = await solanaEconomyService.getBalance(agentId);
    console.log(`Final Agent Balance: ${finalBalance} SOL`);

    if (level === 1 && finalBalance < balanceAfterFunding) {
        console.log("\n✅ Infra Provisioning verified: Agent successfully purchased compute resources.");
    } else {
        console.error("\n❌ Infra Provisioning failed: Resource levels or balances inconsistent.");
        process.exit(1);
    }

    console.log("\n--- Infra Provisioning Verified ---");
    process.exit(0);
}

verify().catch(e => {
    console.error(e);
    process.exit(1);
});
