
import 'dotenv/config';
import { FoldingService } from '../src/services/sectors/biotech/FoldingService.js';

async function main() {
    console.log("🧬 Initializing BioTech Folding Verification...");
    const service = new FoldingService();
    const sequence = "MKTVRQERLEAQFKKQ";

    console.log("\n1️⃣  Folding Protein (Compute Heavy - MSA)...");
    const t1 = Date.now();
    const result1 = await service.execute({ sequence });
    console.log(`   Latency: ${result1.latency_ms}ms`);
    console.log(`   Cached: ${result1.msa_cached}`);

    console.log("\n2️⃣  Re-Folding Same Protein (Cache Hit)...");
    const t2 = Date.now();
    const result2 = await service.execute({ sequence });
    console.log(`   Latency: ${result2.latency_ms}ms`);
    console.log(`   Cached: ${result2.msa_cached}`);

    if (result2.msa_cached && result2.latency_ms! < result1.latency_ms!) {
        console.log("\n✅ FLYWHEEL ACTIVE: Saved GPU Hours.");
    } else {
        console.warn("\n⚠️  Flywheel Warning: Cache not effective.");
    }

    const stats = await service.getStats();
    console.log("\n📊 Telemetry:", stats);
}

main().catch(console.error);
