/**
 * verify_referral_swarms.ts
 * Verification for Phase 6: Cross-Sector Referral Swarms.
 */

import { referralService } from '../src/services/ReferralService.js';
import { solanaEconomyService } from '../src/services/SolanaEconomyService.js';
import { redis } from '../src/lib/redis.js';

async function verify() {
    console.log("--- 🤝 Phase 6: Cross-Sector Referral Swarms Verification ---");

    const referrerId = "agent-fintech-pro";
    const refereeId = "agent-legal-compliance";
    const taskKey = "b2b-aml-deep-audit";

    // 1. Initial State
    console.log("Step 1: Referrer referring task to Referee...");
    const referral = await referralService.createReferral(referrerId, refereeId, taskKey);
    console.log(`Referral Created: ${referral.id} (Status: ${referral.status})`);

    // 2. Accept Referral
    console.log("\nStep 2: Referee accepting referral...");
    const accepted = await referralService.acceptReferral(referral.id);
    
    if (accepted) {
        console.log("✅ Referral Accepted.");
    } else {
        console.error("❌ Referral Acceptance Failed.");
        process.exit(1);
    }

    // 3. Verify Financial Settlement
    console.log("\nStep 3: Verifying Financial Settlement (15.00 SOL split)...");
    const referrerBalance = await solanaEconomyService.getBalance(referrerId);
    const refereeBalance = await solanaEconomyService.getBalance(refereeId);

    console.log(`Referrer (${referrerId}) Balance: ${referrerBalance} SOL`);
    console.log(`Referee (${refereeId}) Balance: ${refereeBalance} SOL`);

    // Split logic: 15 SOL -> 70% to Provider (Referrer), 20% System, 10% Referee (Savings)
    // 15 * 0.7 = 10.5
    // 15 * 0.1 = 1.5
    if (referrerBalance === 10.5 && refereeBalance === 1.5) {
        console.log("\n✅ Referral Settlement verified: Cross-sector economy active.");
    } else {
        console.error("\n❌ Financial Settlement failed. Balances inconsistent.");
        process.exit(1);
    }

    console.log("\n--- Phase 6 Referral Swarms Verified ---");
    process.exit(0);
}

verify().catch(e => {
    console.error(e);
    process.exit(1);
});
