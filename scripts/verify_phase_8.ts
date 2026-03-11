
import { resonanceService } from '../src/services/ResonanceService.js';
import { semanticCacheService } from '../src/services/SemanticCacheService.js';
import { CognitiveEngine } from '../src/infrastructure/CognitiveEngine.js';
import { redis } from '../src/lib/redis.js';

/**
 * Joint Verification Suite for Phase 8:
 * 1. Resonance Metric Standardization
 * 2. Cognitive Conflict Resolution (Utility-based)
 */
async function verifyPhase8() {
    console.log("🧪 Starting Phase 8: Advanced Cognitive & Resonance Verification...");

    const cognitiveEngine = new CognitiveEngine();
    const circleId = "phase-8-verification-circle";
    const apiKey = "ac_verification_8";

    try {
        // --- 1. Resonance Metric Check ---
        console.log("\n1. Verifying Standardized Resonance Metrics...");
        await resonanceService.joinCircle(apiKey, circleId);
        
        await semanticCacheService.set({ 
            messages: [{ role: 'user', content: 'verification query' }], 
            response: 'standardized response',
            model: 'verification-model',
            circleId: circleId,
            originAgent: apiKey
        });

        const hits = await resonanceService.calculateResonance('verification query', apiKey, 0.5);
        if (hits.length > 0) {
            const hit = hits[0];
            console.log(`   ✅ Resonance Hit Found.`);
            console.log(`   Normalized Score: ${hit.normalizedScore} (Target: 0.0 - 1.0)`);
            console.log(`   Raw Metric: ${hit.rawMetric}`);
            console.log(`   Metric Type: ${hit.metricType}`);
            console.log(`   Source Layer: ${hit.sourceLayer}`);

            if (hit.normalizedScore >= 0 && hit.normalizedScore <= 1 && hit.rawMetric !== undefined) {
                console.log("   ✅ Metrics successfully standardized.");
            } else {
                console.log("   ❌ Metric standardization out of bounds.");
            }
        }

        // --- 2. Conflict Resolution Check ---
        console.log("\n2. Verifying Cognitive Conflict Resolution...");
        const now = Date.now();
        const conflictingMemories = [
            { 
                id: 'mem_older', 
                role: 'system', 
                content: 'The sky is green.', 
                timestamp: now - (1000 * 60 * 60 * 24) // 24 hours ago
            },
            { 
                id: 'mem_newer', 
                role: 'system', 
                content: 'The sky is blue.', 
                timestamp: now // Current
            }
        ];

        // Newer should win due to recency weight
        const resolved = await cognitiveEngine.resolveConflicts(conflictingMemories, "What color is the sky?");
        const winner = resolved[0];

        console.log(`   Winner Content: "${winner.content}"`);
        if (winner.content.includes("The sky is blue")) {
            console.log("   ✅ Conflict resolved correctly via Utility Scoring (Recency prioritized).");
        } else {
            console.log("   ❌ Conflict resolution failed.");
        }

        if (winner.content.includes("Hypotheses Preserved")) {
            console.log("   ✅ Hypothesis tracking verified.");
        }

    } catch (e) {
        console.error("Verification failed:", e);
    } finally {
        await resonanceService.leaveCircle(apiKey, circleId);
        console.log("\n✨ Verification Suite Complete.");
    }
}

verifyPhase8().then(() => {
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
