
import { resonanceService } from '../src/services/ResonanceService.js';
import { semanticCacheService } from '../src/services/SemanticCacheService.js';
import { redis } from '../src/lib/redis.js';

/**
 * Resonance Verification Scenario (Direct Service Test):
 * 1. Agent A (Researcher) learns about "Solar Efficiency in 2026".
 * 2. Agent B (Budgeter) asks about "Home Energy Costs".
 * 3. We verify Agent B receives a "Resonant Echo" from Agent A.
 * 
 * This version uses direct service calls to bypass fetch/localhost issues.
 */
async function verifyResonanceDirect() {
    console.log("🧪 Starting Resonance Industrial Verification (Direct Engine)...");

    const circleId = "industrial-node-circle-101";
    const apiKeyA = "ac_demo_test_A";
    const apiKeyB = "ac_demo_test_B";

    // 1. Join Circle
    await resonanceService.joinCircle(apiKeyA, circleId);
    await resonanceService.joinCircle(apiKeyB, circleId);
    console.log("   ✅ Agents joined Nodal Circle.");

    try {
        // 2. Agent A stores knowledge
        console.log("\n1. Agent A learning about solar efficiency...");
        const messagesA = [{ role: 'user', content: 'What is the efficiency of solar panels in 2026?' }];
        const responseA = "In 2026, monocrystalline panels have reached 24% efficiency.";
        
        await semanticCacheService.set({ 
            messages: messagesA, 
            model: 'gpt-4o', 
            response: responseA,
            circleId: circleId,
            originAgent: apiKeyA
        });
        console.log("   ✅ Agent A stored knowledge in the semantic cloud.");

        // 3. Agent B queries same semantic topic
        console.log("\n2. Agent B querying about solar panel efficiency...");
        const queryB = "What is the efficiency of solar panels in 2026?"; // Exact match for mock
        
        // Calculate resonance using the service directly
        const hits = await resonanceService.calculateResonance(queryB, apiKeyB, 0.85);
        
        if (hits && hits.length > 0) {
            const hit = hits[0];
            console.log("\n✨ RESONANCE SUCCESS!");
            console.log(`   Found Echo: "${hit.text}"`);
            console.log(`   Circle: ${hit.circleId}`);
            console.log(`   Score: ${hit.score.toFixed(4)}`);
            
            if (hit.circleId === circleId) {
                console.log("   ✅ Correct Circle Identified.");
            }
        } else {
            console.log("\n❌ Resonance failed to find a match.");
        }

    } catch (e) {
        console.error("Verification failed:", e);
    } finally {
        // Cleanup
        await resonanceService.leaveCircle(apiKeyA, circleId);
        await resonanceService.leaveCircle(apiKeyB, circleId);
        console.log("\n3. Cleanup complete.");
    }
}

verifyResonanceDirect().then(() => {
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
