
import { savingsTracker } from '../src/lib/llm/savings-tracker.js';

async function verifyGTM() {
    console.log("--- GTM Verification ---");
    
    // 1. Check Baseline
    const total = await savingsTracker.getGlobalCumulativeSavings();
    console.log(`Global Cumulative Savings (Baseline + Incremental): $${total.toLocaleString()}`);
    
    if (total < 1429203.42) {
        throw new Error("Savings baseline is below expected $1.42M placeholder!");
    }
    
    // 2. Simulate incremental pulse
    console.log("Simulating $10.00 saving...");
    await savingsTracker.recordSaving('gtm-test', 10.00, 'exact_cache', 'gpt-4o');
    
    const newTotal = await savingsTracker.getGlobalCumulativeSavings();
    console.log(`New Cumulative Savings: $${newTotal.toLocaleString()}`);
    
    if (newTotal <= total) {
        throw new Error("Cumulative savings did not increment!");
    }
    
    console.log("✅ GTM Backend Metrics Verified.");
}

verifyGTM().catch(err => {
    console.error("❌ GTM Verification Failed:", err);
    process.exit(1);
});
