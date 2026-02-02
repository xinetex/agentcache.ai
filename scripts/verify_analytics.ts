
import 'dotenv/config';
import { analytics } from '../src/services/AnalyticsService.js';
import { growthAgent } from '../src/agents/GrowthAgent.js';

async function main() {
    console.log("📊 Verifying Analytics Service...");

    // Log a test decision
    await analytics.logDecision(
        growthAgent.id,
        "TEST_ANALYTICS",
        "Verifying that the analytics pipeline writes to the DB.",
        { success: true, timestamp: Date.now() }
    );

    console.log("✅ Decision logged. Check 'decisions' table.");
}

main().catch(console.error);
