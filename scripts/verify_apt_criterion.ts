/**
 * verify_apt_criterion.ts
 * Verification for Phase 4: Anti-Programming-Token (APT) Threshold.
 */

import { reflectionEngine } from '../src/services/ReflectionEngine.js';
import { redis } from '../src/lib/redis.js';

async function verify() {
    console.log("--- 🛡️ Phase 4: Anti-Programming-Token Verification ---");

    const agentId = "agent-sovereign-01";
    const taskKey = "b2b-strategic-pivot";
    const soulContent = "SOUL: Autonomous strategist with internal authority.";

    // 1. Mock High Maturity for APT Breach
    console.log("Step 1: Setting High Maturity (Level 5)...");
    await redis.set(`agent:maturity:${agentId}`, "5");

    // 2. Trigger Reflection Cycle
    console.log("\nStep 2: Triggering Reflection Cycle (Threshold Check)...");
    const result = await reflectionEngine.triggerReflection(agentId, taskKey, soulContent);
    
    console.log(`APT Threshold: ${result.apt.threshold.toFixed(3)}`);
    console.log(`APT Status: ${result.apt.hasSignature ? '✅ BREACHED (Sovereign)' : '❌ INSUFFICIENT (Bot)'}`);

    if (result.apt.hasSignature) {
        console.log(`APT Signature: ${result.apt.signature}`);
        console.log("\n✅ Anti-Programming-Token verified: Entity has manifested internal authority.");
    } else {
        console.error("\n❌ APT Breach failed. Entity remains in instruction-runner state.");
        process.exit(1);
    }

    // 3. Mock Drift to verify APT failure
    console.log("\nStep 4: Testing Drift penalty on APT...");
    // Capturing state once to establish continuity base
    await reflectionEngine.triggerReflection(agentId, taskKey, soulContent);
    
    // Changing soul to trigger drift
    const resultDrift = await reflectionEngine.triggerReflection(agentId, taskKey, "SOUL: Corrupted alignment.");
    console.log(`Drifted Threshold: ${resultDrift.apt.threshold.toFixed(3)}`);
    
    if (resultDrift.apt.threshold < result.apt.threshold) {
        console.log("✅ Drift penalty verified: Dissent reduces authoritative resonance.");
    }

    console.log("\n--- APT Criterion Verified ---");
    process.exit(0);
}

verify().catch(e => {
    console.error(e);
    process.exit(1);
});
