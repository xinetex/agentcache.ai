/**
 * verify_soul_maturity.ts
 * Integration test for the Soul Stack and Maturity Engine.
 */

import { b2bServiceOrchestrator } from '../src/services/B2BServiceOrchestrator.js';
import { maturityEngine } from '../src/services/MaturityEngine.js';
import { redis } from '../src/lib/redis.js';

async function verify() {
    console.log("--- 🧬 Soul Stack Verification ---");

    const clientId = "client-alpha-99";
    const taskKey = "b2b-geo";

    // 1. Provision a service and check if Soul is created
    console.log("Step 1: Provisioning GEO Sentry...");
    const result = await b2bServiceOrchestrator.provisionService({
        clientId,
        type: 'GEO',
        intensity: 'aggressive',
        parameters: { brand: 'AgentCache' }
    });

    const soul = await redis.get(`b2b:soul:${result.swarmId}`);
    if (soul && soul.includes("Axiom: Language is the unit of consciousness")) {
        console.log("✅ Soul Identity provisioned correctly.");
    } else {
        console.log("❌ Soul Identity missing or malformed.");
    }

    // 2. Track Maturity
    console.log("\nStep 2: Testing Maturity Progression...");
    
    // Check initial instruction
    const initial = await maturityEngine.getCompactedInstructions(clientId, taskKey, "Do task X carefully.");
    console.log(`Initial Instructions: "${initial}"`);

    // Simulate 5 successes
    console.log("Recording 5 successes...");
    for (let i = 0; i < 5; i++) {
        await maturityEngine.recordSuccess(clientId, taskKey);
    }

    // Check compacted instruction
    const compacted = await maturityEngine.getCompactedInstructions(clientId, taskKey, "Do task X carefully.");
    console.log(`Compacted Instructions: "${compacted}"`);

    if (compacted.includes("[HEURISTIC-OPTIMIZED]")) {
        console.log("✅ Maturity Engine compaction triggered correctly.");
    } else {
        console.log("❌ Maturity Engine failed to compact context.");
    }

    console.log("\n--- Verification Complete ---");
    process.exit(0);
}

verify().catch(e => {
    console.error(e);
    process.exit(1);
});
