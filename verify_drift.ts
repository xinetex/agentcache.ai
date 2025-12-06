import { DriftWalker } from './src/infrastructure/DriftWalker.js';
import { generateEmbedding } from './src/lib/llm/embeddings.js';

// MOCK SETUP
// We need to simulate a "Model Shift" where the same text generates a different vector.

let CURRENT_MODEL_VERSION = 'v1';
process.env.OPENAI_API_KEY = 'sk-mock-key-for-drift-test';

// Override global fetch to mock OpenAI embedding generation
global.fetch = async (url, options) => {
    if (url.toString().includes('api.openai.com/v1/embeddings')) {
        // Mock Vector Generation
        // V1 = Sine w/ phase shift 0
        // V2 = Sine w/ phase shift PI (Cosine-ish) -> High Drift
        const phase = CURRENT_MODEL_VERSION === 'v1' ? 0 : Math.PI;

        return new Response(JSON.stringify({
            data: [{
                embedding: Array(1536).fill(0).map((_, i) => Math.sin(i + phase))
            }]
        }), { status: 200, statusText: 'OK' });
    }
    // Mock Upstash Vector Fetch/Upsert
    if (url.toString().includes('upstash.io')) {
        // Mock "fetch" response
        if (options.body && options.body.toString().includes('fetch')) {
            return new Response(JSON.stringify({
                result: [{
                    id: 'drift_test_id',
                    // The "Stored" vector is V1 (Sine)
                    vector: Array(1536).fill(0).map((_, i) => Math.sin(i)),
                    metadata: { query: 'The quick brown fox' }
                }]
            }), { status: 200 });
        }
        // Mock "upsert" response
        return new Response(JSON.stringify({ result: 'success' }), { status: 200 });
    }

    return new Response('{}', { status: 200 });
};

async function runDriftVerification() {
    console.log('--- Testing Vector Drift Monitor (DriftWalker) ---');

    const walker = new DriftWalker();

    // MOCK INJECTION: Override the 'index' property to avoid real Upstash connection
    // We mock the 'fetch' and 'upsert' methods required by DriftWalker
    (walker as any).index = {
        fetch: async (ids, opts) => {
            return [{
                id: 'drift_test_id',
                // The "Stored" vector is V1 (Sine)
                vector: Array(1536).fill(0).map((_, i) => Math.sin(i)),
                metadata: { query: 'The quick brown fox' }
            }];
        },
        upsert: async (payload) => {
            console.log('   [MockIndex] Upserting healed vector...');
            return { result: 'success' };
        }
    };

    const testId = 'drift_test_id';

    // 1. Test Healthy State (Model V1)
    console.log(`\n1. Current Model: ${CURRENT_MODEL_VERSION} (Sine)`);
    console.log('   Checking Drift...');
    const result1 = await walker.checkDrift(testId);
    console.log(`   Drift Score: ${result1.drift.toFixed(4)} (Status: ${result1.status})`);

    if (result1.status !== 'healthy') {
        console.error('❌ Expected Healthy status for same model');
        return;
    }
    console.log('✅ Healthy Check Passed');

    // 2. SIMULATE MODEL SHIFT (The "Rot")
    CURRENT_MODEL_VERSION = 'v2'; // Now generates "Cosine" vectors
    console.log(`\n2. Switching to Model: ${CURRENT_MODEL_VERSION} (Cosine / Phase Shift)`);
    console.log('   Checking Drift again...');

    const result2 = await walker.checkDrift(testId);
    console.log(`   Drift Score: ${result2.drift.toFixed(4)} (Status: ${result2.status})`);

    // Sine vs Cosine drift is high
    if (result2.status === 'dead' || result2.status === 'decaying') {
        console.log('✅ Drift Detection Verified: System detected model shift');
    } else {
        console.error('❌ Failed to detect drift. Score was too low.');
    }

    // 3. Test Healing
    console.log('\n3. Healing Vector...');
    const healed = await walker.heal(testId);
    if (healed) console.log('✅ Vector Healed (Updated to V2)');
    else console.error('❌ Healing failed');

}

runDriftVerification();
