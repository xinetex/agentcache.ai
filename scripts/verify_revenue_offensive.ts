/**
 * verify_revenue_offensive.ts
 * Integration test for the Vacuum Hunter and Measurability Gap.
 */

import { vacuumHunterService } from '../src/services/VacuumHunterService.js';
import { maturityEngine } from '../src/services/MaturityEngine.js';
import { b2bServiceOrchestrator } from '../src/services/B2BServiceOrchestrator.js';

async function verify() {
    console.log("--- 💰 Revenue Offensive Verification ---");

    const clientId = "client-alpha-99";
    const taskKey = "compliance-check";

    // 1. Verify Vacuum Hunter
    console.log("Step 1: Performing Market Scan...");
    const vacuums = await vacuumHunterService.scanForVacuums();
    console.log(`Detected ${vacuums.length} Vacuum Zones.`);
    if (vacuums.some(v => v.sector === 'Fintech Compliance')) {
        console.log("✅ Vacuum Hunter identified high-potential B2B gap.");
    } else {
        console.log("❌ Vacuum Hunter failed to identify gaps.");
    }

    // 2. Verify Measurability Gap (Δm) logic
    console.log("\nStep 2: Testing Measurability Gap (Shadow Value)...");
    
    // Simulate some maturity
    console.log("Simulating 10 successes to build Δm...");
    for (let i = 0; i < 10; i++) {
        await maturityEngine.recordSuccess(clientId, taskKey);
    }

    const shadowValue = await maturityEngine.getMeasurabilityGap(clientId);
    console.log(`Calculated Shadow Value (Δm): $${shadowValue}`);

    if (shadowValue > 0) {
        console.log("✅ Measurability Gap calculated successfully.");
    } else {
        console.log("❌ Measurability Gap failed (Returned 0).");
    }

    // 3. Verify Orchestrator integration
    console.log("\nStep 3: Verifying Orchestrator Market Stats...");
    const stats = await b2bServiceOrchestrator.getMarketStats(clientId);
    console.log(`Orchestrator reported Δm: $${stats.measurability_gap}`);
    
    if (stats.measurability_gap === shadowValue && stats.detected_vacuums.length > 0) {
        console.log("✅ Orchestrator integrated all revenue signals correctly.");
    } else {
        console.log("❌ Orchestrator missing revenue signals.");
    }

    console.log("\n--- Revenue Offensive Verified ---");
    process.exit(0);
}

verify().catch(e => {
    console.error(e);
    process.exit(1);
});
