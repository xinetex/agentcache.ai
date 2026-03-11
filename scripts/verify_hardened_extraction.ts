
import { semanticBusService } from '../src/services/SemanticBusService.js';
import { redis } from '../src/lib/redis.js';

/**
 * Hardened Extraction Verification:
 * 1. Test Typed Template: "Risk reduces returns" 
 *    - Should match (Metric:REDUCES:Metric)
 * 2. Test Ontology Filter: "The patient manages the risk"
 *    - (Entity:MANAGES:Metric) is NOT in allowed triples.
 *    - Resolver should reject or downgrade this.
 * 3. Test Co-occurrence fallback.
 */
async function verifyHardenedExtraction() {
    console.log("🧪 Starting Phase 7.2: Hardened Extraction Verification...");

    // Clear stream
    await redis.del('cortex:stream:synapses');

    // 1. Valid Typed Template
    console.log("\n1. Testing Typed Template Pattern...");
    const msg1 = {
        sector: 'FINANCE',
        content: "New settlement protocols efficiently reduce risk in the asset pool.",
        ontologyRef: "finance@1.0.0"
    };
    await semanticBusService.publish(msg1);

    const raw1 = await redis.xrevrange('cortex:stream:synapses', '+', '-', 'COUNT', 1);
    const entry1 = parseStreamEntry(raw1[0]);
    const relations1 = JSON.parse(entry1.relations);

    console.log(`   Entities: ${entry1.entities}`);
    console.log(`   Extracted Relations: ${JSON.stringify(relations1)}`);
    
    const hasReduces = relations1.some((r: any) => r.predicate === 'REDUCES');
    if (hasReduces) {
        console.log("   ✅ Success: 'REDUCES' template pattern matched.");
    } else {
        console.log("   ❌ Failure: 'REDUCES' pattern not matched.");
    }

    // 2. Invalid Triple (Post-Filter)
    console.log("\n2. Testing Ontology Post-Filter (Rejection/Correction)...");
    const msg2 = {
        sector: 'FINANCE',
        content: "The asset manages the risk metrics.",
        ontologyRef: "finance@1.0.0"
    };
    // (Entity:MANAGES:Metric) is INVALID. (AI:MANAGES:Infrastructure) or (Process:REDUCES:Metric) are valid.
    await semanticBusService.publish(msg2);

    const raw2 = await redis.xrevrange('cortex:stream:synapses', '+', '-', 'COUNT', 1);
    const entry2 = parseStreamEntry(raw2[0]);
    const relations2 = JSON.parse(entry2.relations);

    console.log(`   Extracted Relations: ${JSON.stringify(relations2)}`);
    const hasInvalid = relations2.some((r: any) => r.predicate === 'MANAGES' && r.subject === 'asset');
    
    if (hasInvalid) {
        console.log("   ❌ Failure: Invalid triple 'asset MANAGES risk' was NOT filtered.");
    } else {
        console.log("   ✅ Success: Invalid triple was filtered or corrected.");
    }

    console.log("\n✨ Hardened Extraction Verification Complete.");
}

function parseStreamEntry(raw: any) {
    if (!raw) return {};
    const fields = raw[1];
    const entry: any = {};
    for (let i = 0; i < fields.length; i += 2) {
        entry[fields[i]] = fields[i+1];
    }
    return entry;
}

verifyHardenedExtraction().then(() => {
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
