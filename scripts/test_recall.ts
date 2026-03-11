
import { BancacheService } from '../src/services/bancache.js';
import { db } from '../src/db/client.js';
import { bancache as bancacheTable } from '../src/db/schema.js';

async function testRecall() {
    console.log("=== Semantic Recall Verification ===");
    const service = new BancacheService();
    
    // 1. Ingest a banner (The "Memory")
    const originalBanner = "Apache/2.4.41 (Ubuntu) Server at example.com Port 80";
    const hash = await service.ingest(originalBanner);
    console.log(`✅ Ingested original: ${hash.substring(0,8)}...`);

    // 2. Query a "Near-Miss" (Slightly different text, different hash)
    const nearMissBanner = "Apache/2.4.41 (Ubuntu) Server at example.com Port 443";
    const nearMissHash = BancacheService.hashBanner(nearMissBanner);
    console.log(`🔍 Querying near-miss: ${nearMissHash.substring(0,8)}...`);

    // 3. Insert the near-miss into bancache so getAnalysis finds a row but no analysis
    await db.insert(bancacheTable).values({
        hash: nearMissHash,
        bannerText: nearMissBanner,
        seenCount: 1
    });

    // 4. Retrieve Analysis (Should trigger Intuition fallback)
    const result = await service.getAnalysis(nearMissHash);
    
    if (result && result.analysis?.classification === 'Intuitive Prediction') {
        console.log("🎯 SUCCESS: Intuition Layer correctly identified the semantic neighbor!");
        console.log(`📝 Reasoning: ${result.analysis.reasoning}`);
    } else {
        console.error("❌ FAILURE: Intuition Layer did not trigger as expected.");
        console.log("Result:", JSON.stringify(result, null, 2));
    }
}

testRecall().catch(console.error);
