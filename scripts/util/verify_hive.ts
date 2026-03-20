import { RosNode, SensorData, Action } from './src/edge/RosNode.js';

// MOCK HIVE BACKEND (Shared Cloud Memory)
// We need to store Vectors now
interface SharedMem {
    vector: number[];
    action: Action;
}
const HIVE_MEMORY: SharedMem[] = [];

// Monkey-patch RosNode to use our shared HIVE_MEMORY
(RosNode.prototype as any).queryHiveVector = async function (query: number[]) {
    // Reuse the internal logic for finding nearest neighbor in HIVE collection
    // We can call the private method 'findMatchInCollection' if we cast to any, 
    // OR just re-implement simple cosine scan here for the test.

    let maxSim = -1;
    let bestMatch = null;

    // Naive Dot Product (Mock Cosine)
    for (const item of HIVE_MEMORY) {
        // Dot product
        let dot = 0, nA = 0, nB = 0;
        for (let i = 0; i < query.length; i++) {
            dot += query[i] * item.vector[i];
            nA += query[i] * query[i];
            nB += item.vector[i] * item.vector[i];
        }
        const sim = dot / (Math.sqrt(nA) * Math.sqrt(nB));

        if (sim > maxSim) {
            maxSim = sim;
            bestMatch = item;
        }
    }

    if (bestMatch && maxSim > 0.85) {
        return { engram: bestMatch, similarity: maxSim };
    }
    return null;
};

(RosNode.prototype as any).uploadToHiveVector = async function (vector: number[], action: Action) {
    HIVE_MEMORY.push({ vector, action });
};

async function runHiveTest() {
    console.log('--- Testing The Hive Mind (Stage 5) ---');

    const alpha = new RosNode('Alpha_Bot');
    const beta = new RosNode('Beta_Bot');

    // SCENARIO: Robot sees an obstacle with sensitive text (e.g. OCR)
    // "Obstacle detected. Label: Patient data MRN:123456"
    const sensitiveInput = "Obstacle detected. Label: Patient MRN:123456";
    const sensorData: SensorData = {
        type: 'text',
        payload: sensitiveInput,
        timestamp: Date.now()
    };

    console.log(`\n1. Alpha_Bot encounters: "${sensitiveInput}"`);
    console.log('   Expected: Redact MRN, Compute Action, Upload to Hive');

    const actionA = await alpha.process(sensorData);

    console.log(`   Alpha Action: ${actionA.command} (Source: ${actionA.source})`);

    if (actionA.source !== 'compute') {
        console.error('❌ Alpha should have computed this (Cache Miss)');
        return;
    }

    // Verify Redaction Logic (Console logs in RosNode show it, but logic check:)
    // We can check if the HIVE_MEMORY key corresponds to the hash of the *original* or *redacted*?
    // Actually, RosNode hashes the *original* raw bytes for the key (perceptual hash),
    // but the *processed/stored* data/logs should be clean.

    // Let's verify Beta learns it instantly
    console.log('\n2. Beta_Bot encounters SAMETHING');
    console.log('   Expected: Instant Cache Hit (Fleet Learning)');

    // Beta needs to see the same "Perceptual Input"
    const sensorDataB = { ...sensorData, timestamp: Date.now() + 1000 };

    const actionB = await beta.process(sensorDataB);
    console.log(`   Beta Action: ${actionB.command} (Source: ${actionB.source})`);

    if (actionB.source === 'cache') {
        console.log('✅ Hive Mind Verified: Beta learned from Alpha instantly.');
    } else {
        console.error('❌ Beta missed cache. Fleet learning failed.');
    }
}

runHiveTest();
