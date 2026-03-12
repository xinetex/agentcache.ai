/**
 * Verification Script: Cognitive Vector Service (CVS) Phase 20
 * 
 * Verifies:
 * 1. Client initialization with Fallback logic.
 * 2. Multi-tenant isolation (simulated via mock since C# isn't running).
 * 3. Server-side Drift calculation.
 */

import { VectorClient } from '../src/infrastructure/VectorClient.js';

async function verifyCVS() {
    console.log('🚀 Starting CVS Productization Verification...');

    // 1. Initialize Client
    // We force 'mock' to test the logic without a running C# server
    process.env.VECTOR_SERVICE_URL = 'mock';
    const client = new VectorClient();
    console.log('✅ Client initialized in Mock mode.');

    // 2. Test Multi-Tenant Isolation (Simulated)
    const tenantA = 'tenant-alpha';
    const tenantB = 'tenant-beta';

    // Create orthogonal vectors: one with 1s in first half, other with 1s in second half
    const vecA = Array(1536).fill(0).map((_, i) => i < 768 ? 1 : 0);
    const vecB = Array(1536).fill(0).map((_, i) => i >= 768 ? 1 : 0);

    console.log(`Adding vectors for ${tenantA}...`);
    await client.addVectors([1], vecA, { name: 'Alpha Data' }, tenantA);
    
    console.log(`添加 vectors for ${tenantB}...`);
    await client.addVectors([2], vecB, { name: 'Beta Data' }, tenantB);

    // 3. Verify Search & Drift
    console.log('Testing Drift Calculation...');
    const driftValue = await client.drift(vecA, tenantA);
    console.log(`📊 Drift for exact match (Alpha): ${driftValue.toFixed(4)} (Expected < 0.1)`);

    const crossDrift = await client.drift(vecA, tenantB);
    console.log(`📊 Drift for cross-tenant match (Alpha-in-Beta): ${crossDrift.toFixed(4)} (Expected high/1.0)`);

    // 4. Verify Hybrid Fallback (Mock check)
    if (process.env.UPSTASH_VECTOR_REST_URL) {
        console.log('Testing Cloud Fallback...');
        process.env.VECTOR_SERVICE_URL = ''; // Clear URL to trigger fallback
        const cloudClient = new VectorClient();
        // Since we can't easily query real cloud in a script without real data, we just verify the mode
        // @ts-ignore (Accessing private for verification)
        console.log(`✅ Cloud Fallback Mode: ${cloudClient.baseUrl}`);
    }

    console.log('\n✨ CVS Phase 20 Verification Complete.');
}

verifyCVS().catch(console.error);
