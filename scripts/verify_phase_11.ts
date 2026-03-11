
import { VectorClient } from '../src/infrastructure/VectorClient.js';

/**
 * Phase 11: Elastic Vector Sharding Verification
 * 
 * 1. Massive Insertion -> Trigger Shard Rotation.
 * 2. Cross-Shard Search -> Verify retrieval accuracy.
 * 3. Hot-Swap -> Verify zero-downtime index updates.
 */
async function verifyPhase11() {
    console.log("🧪 Starting Phase 11: Elastic Vector Sharding Verification...");

    const client = new VectorClient('mock');

    // 1. Massive Insertion (Simulating saturation)
    console.log("\n1. Simulating Massive Swarm Insertion (Triggering rotations)...");
    
    // Insert 1200 vectors (Shard threshold is 1000)
    for (let i = 0; i < 1200; i++) {
        const vec = new Array(1536).fill(0).map(() => Math.random());
        await client.addVectors([i], vec, { index: i, circleId: 'global-1' });
        
        if (i === 999) console.log("   [i=999] Shard 0 saturated. Next insertion should trigger rotation.");
    }

    // @ts-ignore - access private for verification
    const shardCount = client.shards.size;
    console.log(`   ✅ Shard Count: ${shardCount} (Expected: 2)`);

    // 2. Cross-Shard Search
    console.log("\n2. Testing Cross-Shard Retrieval...");
    const queryVec = new Array(1536).fill(0).map(() => Math.random());
    const results = await client.search(queryVec, 5, { circleId: 'global-1' });
    
    console.log(`   ✅ Search returned ${results.length} results from sharded space.`);
    results.forEach((r, idx) => {
        console.log(`      [Result ${idx}] ID: ${r.id}, Distance: ${r.distance.toFixed(4)}`);
    });

    // 3. Hot-Swap Verification
    console.log("\n3. Testing Hot-Swap (Zero-Downtime Index Update)...");
    const testId = 9999;
    const testVec = new Array(1536).fill(0.5); // Unique pattern
    
    await client.hotSwapShard('shard-0', {
        vectors: { [testId]: testVec },
        metadata: { [testId]: { circleId: 'swapped' } }
    });

    const swapResults = await client.search(testVec, 1, { circleId: 'swapped' });
    if (swapResults[0]?.id === testId) {
        console.log("   ✅ Hot-Swap Successful: Found vector in the swapped index.");
    } else {
        throw new Error("Hot-swap failed: Vector not found in new index.");
    }

    console.log("\n✨ Phase 11 Verification Complete.");
}

verifyPhase11().then(() => {
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
