
import 'dotenv/config';
import { PatternEngine } from '../src/infrastructure/PatternEngine.js';
import { db } from '../src/db/client.js';
import { patterns } from '../src/db/schema.js';
import { upsertMemory } from '../src/lib/vector.js';

async function main() {
    console.log('🧪 Starting Holographic Memory Verification...');

    // 0. Setup: Ensure we have vector memory populated
    const TEST_MEMORY = "The void was bright purple and smelled of ozone.";
    // Using a fake UUID for memory that corresponds to a concept
    const MEMORY_ID = "00000000-0000-0000-0000-000000000099";

    console.log(`[Setup] Seeding memory: "${TEST_MEMORY}"`);
    // Ideally PatternEngine would do this, but we seed manually to ensure it exists for the "Recall" test.
    await upsertMemory(MEMORY_ID, TEST_MEMORY, { type: 'sensation' });

    // 1. Initialize Engine
    const engine = new PatternEngine();

    // 2. Create a "Dreamer" Agent
    // This agent has the 'generate_thought' action which triggers recall.
    console.log('📝 Creating Dreamer Agent...');
    const [dreamer] = await db.insert(patterns).values({
        name: 'The Sleeper',
        intent: 'Dream of the Void',
        status: 'active',
        energyLevel: 10
    }).returning();

    // 3. Trigger "Dreaming" (which performs Recall)
    // The Dreamer picks a random concept. We can't easily force it to pick "Void" without mocking Math.random or changing code.
    // However, our code searches for `Sensation of ${seed}`.
    // If we want to verify it works, we should ideally mock the specific call, but let's see if we can just trigger it.
    // We will FORCE a specific action sequence to ensure the right key is searched.

    /* 
       Wait, PatternEngine logic for 'generate_thought' is:
       const concepts = ["Time", "Void", "Silence", "Entropy", "Growth", "Light", "Echo"];
       const seed = concepts[...];
       searchMemory(`Sensation of ${seed}`);
    */

    // To deterministically test, we can modify the agent to perform a `update_cache` action
    // which calls `storeMemoryVector`. But we want to test RECALL.
    // The `generate_thought` action is hardcoded to random seeds. 
    // BUT! We can use `PatternEngine.imitate` or just accept that we might hit it? No, deterministic is better.

    // Let's rely on the fact that we can just call `cognitiveEngine.searchMemory` directly via a helper or 
    // observe the logs. 
    // Actually, let's verify storage first via `update_cache` action.

    const storeAction = {
        type: 'update_cache',
        message: 'Storing a new thought'
    };

    console.log('☁️  Triggering Memory Storage...');
    await engine.executeAction({
        ...dreamer,
        actionSequence: storeAction
    });

    // Verification: We need to see if it called upsert. 
    // Since we can't easily spy on imports in this runtime without Jest,
    // we will assume success if no error and logs appear.
    // But for Recall... let's try to add a specific "Recall" action to PatternEngine?
    // Or just trust the logs for this manual verification.

    // Let's try to trigger the Dreamer loop a few times to see if it hits "Void" or "Light".
    // We will seed memories for ALL concepts.

    const concepts = ["Time", "Void", "Silence", "Entropy", "Growth", "Light", "Echo"];
    for (const c of concepts) {
        await upsertMemory(`00000000-0000-0000-0000-00000000010${concepts.indexOf(c)}`,
            `A vivid sensation of ${c} involving deep purple hues.`, {});
    }

    const dreamAction = {
        type: 'generate_thought'
    };

    console.log('💤 Triggering Dream Cycle...');
    // Execute multiple times to increase chance of hitting a seeded memory
    await engine.executeAction({ ...dreamer, actionSequence: dreamAction });
    await engine.executeAction({ ...dreamer, actionSequence: dreamAction });

    console.log('✅ Verification Script Completed. Check logs for "RECALLED ECHO".');
    process.exit(0);
}

main().catch(console.error);
