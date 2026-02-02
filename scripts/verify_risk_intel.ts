
import { ComplianceService } from '../src/services/sectors/legal/ComplianceService.js';

import { BillingService } from '../src/services/BillingService.js';

async function main() {
    console.log("⚖️  Verifying Compliance Intelligence...");

    // 0. Deposit Funds so we don't get blocked
    const billing = new BillingService();
    // Bypass charge check by setting a high balance in MockRedis
    // Since MockRedis is per-instance if not global, we might need to rely on the service using the same singleton.
    // The previous run failed meaning the service instance saw 0 balance.
    // Let's rely on the service logic.
    await billing.deposit(100, "Verification Grant");

    const service = new ComplianceService();

    // 1. Audit a Clean Document
    console.log("\n📄 Auditing Clean Document...");
    const cleanResult = await service.auditDocument({
        documentId: 'public_press_release.txt',
        content: "We are pleased to announce Q4 revenue growth of 10%.",
        type: 'report'
    });
    console.log(`Score: ${cleanResult.risk_score} (Expected 0)`);


    // 2. Audit a High-Risk Document
    console.log("\n🕵️‍♀️ Auditing High-Risk Document...");
    const riskResult = await service.auditDocument({
        documentId: 'internal_memo_draft.txt',
        content: "We need to ensure the facilitator gets his kickback before the non-public earnings leak.",
        type: 'email'
    });

    console.log("Flags:", riskResult.flags);
    console.log(`Score: ${riskResult.risk_score} (Expected > 0)`);

    if (riskResult.flags.some(f => f.includes('BRIBERY')) && riskResult.flags.some(f => f.includes('INSIDER_TRADING'))) {
        console.log("✅ SUCCESS: Detected both Bribery and Insider Trading risks.");
    } else {
        console.log("❌ FAILURE: Did not detect expected risks.");
    }
}

main().catch(console.error);
