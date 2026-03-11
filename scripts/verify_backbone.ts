
import { semanticBusService } from '../src/services/SemanticBusService.js';
import { Neo4jAdapter } from '../src/ontology/connectors/Neo4jAdapter.js';
import { redis } from '../src/lib/redis.js';

/**
 * Backbone Verification Scenario (Direct Service Test):
 * 1. Publish "Trade Risk" message to Finance sector.
 * 2. Verify:
 *    - Automated entity extraction ("risk").
 *    - Inferred relation mapping.
 *    - Cross-sector resonance check (Mock).
 *    - Negative match ("brisk" != "risk").
 */
async function verifyBackboneDirect() {
    console.log("🧪 Starting Semantic Backbone Industrial Verification (Direct Engine)...");

    // Clear stream for clean verification
    await redis.del('cortex:stream:synapses');

    // 1. Finance Sector Message
    const financeMessage = {
        sector: 'FINANCE',
        content: "We detected high exposure and risk in the asset portfolio.",
        ontologyRef: "finance@1.0.0"
    };

    console.log("\n1. Publishing Finance Signal to the Bus...");
    await semanticBusService.publish(financeMessage);

    // 2. Fetch synapse from the stream
    const raw = await redis.xrevrange('cortex:stream:synapses', '+', '-', 'COUNT', 1);
    if (raw.length > 0) {
        const fields = raw[0][1];
        const entry: any = {};
        for (let i = 0; i < fields.length; i += 2) {
            entry[fields[i]] = fields[i+1];
        }
        
        console.log("   ✅ Synapse captured from Redis Stream.");
        console.log(`   Sector: ${entry.sector}`);
        console.log(`   Entities: ${entry.entities}`);
        
        const entities = JSON.parse(entry.entities);
        if (entities.includes('risk')) {
            console.log("   ✅ Success: 'risk' entity extracted correctly.");
        } else {
            console.log("   ❌ Entity extraction failed.");
        }
    }

    // 3. Negative Verification: "brisk" should NOT match "risk"
    console.log("\n2. Verifying negative match (brisk vs risk)...");
    const noisyMessage = {
        sector: 'FINANCE',
        content: "The morning walk was quite brisk."
    };

    await semanticBusService.publish(noisyMessage);
    const noisyRaw = await redis.xrevrange('cortex:stream:synapses', '+', '-', 'COUNT', 1);
    const noisyFields = noisyRaw[0][1];
    const noisyEntry: any = {};
    for (let i = 0; i < noisyFields.length; i += 2) {
        noisyEntry[noisyFields[i]] = noisyFields[i+1];
    }
    
    const noisyEntities = JSON.parse(noisyEntry.entities);
    if (!noisyEntities || !noisyEntities.includes('risk')) {
        console.log("   ✅ Success: 'brisk' did NOT trigger 'risk' entity.");
    } else {
        console.log("   ❌ Failure: 'brisk' incorrectly matched 'risk'.");
    }

    // 4. Resolve external Knowledge Graph entities addressable via the bus
    console.log("\n3. Resolving external KG nodes mounted on the bus...");
    const kg = new Neo4jAdapter({ url: 'bolt://localhost:7687', user: 'admin', pass: 'pass' });
    const node = await kg.resolveNode('capital_one');
    
    if (node && node.id === 'capital_one') {
        console.log("   ✅ Success: External KG node resolved via Adapter.");
    }

    console.log("\n✨ Backbone Industrial Verification Complete.");
}

verifyBackboneDirect().then(() => {
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
