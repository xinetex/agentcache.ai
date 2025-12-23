
import { PatternEngine } from '../src/infrastructure/PatternEngine.js';
import { db } from '../src/db/client.js';
import { patterns, agentAlerts } from '../src/db/schema.js';
import { eq, desc } from 'drizzle-orm';

async function main() {
    console.log('🧪 Starting Automated Triage Verification...');

    const engine = new PatternEngine();

    // 1. Create a Test Agent (Persistent, so we can check energy level)
    console.log('📝 Creating Victim Agent...');
    const [victim] = await db.insert(patterns).values({
        name: 'Victim Agent 99',
        intent: 'Suffer Low Energy',
        status: 'active',
        energyLevel: 5
    }).returning();

    console.log(`✅ Victim Agent Created: ${victim.id} (Energy: ${victim.energyLevel})`);

    // 2. Trigger Distress Signal (Metabolic Exhaustion)
    // NOTE: In the real engine, context is built automatically.
    // But for this test, we are manually injecting the action, pretending the agent *generated* it.
    // The engine's signalDistress method builds the context.
    const distressAction = {
        type: 'signal_distress',
        message: 'My energy is drained! I need sustenance!',
        severity: 'medium'
    };

    console.log('🆘 Triggering Distress Signal...');

    // We execute the action on behalf of the victim
    // The engine should:
    // 1. Persist Alert
    // 2. Spawn Triage Officer
    // 3. Triage Officer runs 'diagnose_fault' -> 'boost_energy'
    // 4. Energy of victim should increase
    await engine.executeAction({
        ...victim,
        actionSequence: distressAction
    });

    // 3. Wait for Triage (It's async/recursive in our MVP implementation)
    console.log('⏳ Waiting for Triage Response...');
    await new Promise(r => setTimeout(r, 2000));

    // 4. Verify Triage Officer Existence
    console.log('🔍 Checking for Triage Officer...');
    const officers = await db.select().from(patterns).where(eq(patterns.name, 'Triage Officer'));
    if (officers.length > 0) {
        console.log(`✅ Triage Officer Found: ${officers[0].id}`);
    } else {
        console.error('❌ Triage Officer NOT found.');
    }

    // 5. Verify Victim Energy
    console.log('🔍 Checking Victim Status...');
    const [updatedVictim] = await db.select().from(patterns).where(eq(patterns.id, victim.id));

    console.log(`📊 Victim Energy: ${updatedVictim.energyLevel}`);

    if (updatedVictim.energyLevel > 5) {
        console.log(`✅ Verification PASSED: Victim energy boosted from 5 to ${updatedVictim.energyLevel}.`);
        process.exit(0);
    } else {
        console.error('❌ Verification FAILED: Victim energy did not increase.');
        process.exit(1);
    }
}

main().catch(console.error);
