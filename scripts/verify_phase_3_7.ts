import { intuitionService } from '../src/services/IntuitionService.js';
import { coherenceService } from '../src/services/CoherenceService.js';
import { redis } from '../src/lib/redis.js';

async function testPhase37() {
    console.log("🧪 Starting Phase 3.7 Verification (Latent Guardrails)...");

    // 1. Run Manipulator Canary
    console.log("\n1. Running Manipulator Canary (Semantic Grounding)...");
    const passed = await intuitionService.runManipulatorCanary();
    console.log(`   Canary Result: ${passed ? '✅ PASSED' : '❌ FAILED'}`);

    // 2. Verify Coherence Integration
    console.log("\n2. Verifying Coherence Integration...");
    const swarmId = 'global-swarm';
    
    // Clear old health cache to force recalculation
    await redis.del(`swarm:health:${swarmId}`);
    
    // Simulate a drift detection
    await redis.set('system:intuition:drift', 'detected');
    
    const health = await coherenceService.calculateDivergence(swarmId);
    console.log(`   Swarm Status: ${health.status}`);
    console.log(`   Intuition Drift Flag: ${health.intuitionDrift}`);

    if (health.intuitionDrift === true && health.status === 'degraded') {
        console.log("   ✅ SUCCESS: CoherenceService correctly surfaced Manipulator Drift.");
    } else {
        console.warn("   ❌ FAILURE: CoherenceService missed the drift flag.");
    }

    process.exit(0);
}

testPhase37().catch(err => {
    console.error(err);
    process.exit(1);
});
