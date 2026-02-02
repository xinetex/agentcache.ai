import { billing } from '../src/lib/payment/billing.js';
import { wallet } from '../src/lib/payment/wallet.js';

async function verifyStack() {
    console.log("=== Verifying Revenue Stack ===");

    // 1. Verify Billing (Stripe)
    console.log("\n[1] Testing BillingManager...");
    try {
        await billing.recordUsage('sub_test_123', 5);
        console.log("✅ Billing Usage Reported");
    } catch (e) {
        console.error("❌ Billing Failed:", e);
    }

    // 2. Verify Wallet (Solana)
    console.log("\n[2] Testing AgentWallet...");
    try {
        const address = wallet.getAddress();
        console.log(`✅ Wallet Address: ${address}`);

        // 3. Verify Treasury Logic
        // We won't actually send funds because we have 0 balance, but we can verify the method exists
        console.log("\n[3] Testing Treasury Logic...");
        if (typeof wallet.payTreasury === 'function') {
            console.log("✅ payTreasury() method exists");
            // Dry run intended to fail on 'Insufficient Funds' but prove the call works
            try {
                await wallet.payTreasury(0.0001);
            } catch (e: any) {
                if (e.message.includes('insufficient funds') || e.message.includes('Attempt to debit an account but found no record')) {
                    console.log("✅ Treasury Call Attempted (Failed as expected: Insufficient Funds)");
                } else {
                    console.warn(`⚠️ Unexpected treasury error: ${e.message}`);
                }
            }
        } else {
            console.error("❌ payTreasury() method MISSING");
        }

    } catch (e) {
        console.error("❌ Wallet Logic Failed:", e);
    }

    console.log("\n=== Verification Complete ===");
}

verifyStack().catch(console.error);
