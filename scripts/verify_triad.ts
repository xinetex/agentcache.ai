
import 'dotenv/config';
import { MotionService } from '../src/services/sectors/robotics/MotionService.js';
import { FoldingService } from '../src/services/sectors/biotech/FoldingService.js';
import { RiskService } from '../src/services/sectors/finance/RiskService.js';

async function main() {
    console.log("🌐 VERIFYING AGENT SECTOR TRIAD (V1)...");

    // 1. Robotics
    console.log("\n🤖 [SECTOR 1] ROBOTICS");
    const motion = new MotionService();
    const mRes1 = await motion.planPath({ sx: 0, sy: 0, gx: 10, gy: 10 });
    const mRes2 = await motion.planPath({ sx: 0, sy: 0, gx: 10, gy: 10 });
    console.log(`   Compute: ${mRes1.latency}ms | Cache: ${mRes2.latency}ms`);
    if (mRes2.from_cache) console.log("   ✅ MotionCache Active");

    // 2. BioTech
    console.log("\n🧬 [SECTOR 2] BIOTECH");
    const fold = new FoldingService();
    const fRes1 = await fold.execute({ sequence: "TEST_SEQ" });
    const fRes2 = await fold.execute({ sequence: "TEST_SEQ" });
    console.log(`   Compute: ${fRes1.latency_ms}ms | Cache: ${fRes2.latency_ms}ms`);
    if (fRes2.msa_cached) console.log("   ✅ FoldingCache Active");

    // 3. Finance
    console.log("\n📈 [SECTOR 3] FINANCE");
    const risk = new RiskService();
    const rRes1 = await risk.execute({ portfolio: { BTC: 1 }, scenario: "crash" });
    const rRes2 = await risk.execute({ portfolio: { BTC: 1 }, scenario: "crash" });
    console.log(`   Compute: ${rRes1.latency_ms}ms | Cache: ${rRes2.latency_ms}ms`);
    if (rRes2.from_cache) console.log("   ✅ RiskCache Active");

    console.log("\n✨ TRIAD OPERATIONAL.");
}

main().catch(console.error);
