import { eventBus } from '../src/lib/event-bus.js';
import { cognitiveMemory } from '../src/services/cognitive-memory.js';

console.log('--- Phase 23: Resonance Event Verification ---');

const receivedEvents: string[] = [];
const unsubscribe = eventBus.subscribe((event) => {
    console.log(`[Event Received] Type: ${event.type}, Source: ${event.source}`);
    receivedEvents.push(event.type);
});

async function runTest() {
    console.log('\n1. Triggering observeTransition (Latent Manipulation)...');
    await cognitiveMemory.observeTransition('What is the weather?', 'How is the temperature?');
    
    console.log('\n2. Triggering recordCacheOutcome (Cache Hit)...');
    await cognitiveMemory.recordCacheOutcome(true);
    
    console.log('\n3. Triggering assessDrift (Drift Detected/Healed)...');
    // We use a dummy ID here, might not trigger full heal but should trigger event if status check fails
    await cognitiveMemory.assessDrift('test-id', true);

    console.log('\n--- Results ---');
    console.log('Events captures:', receivedEvents);
    
    const expected = ['latent_manipulation', 'cache_hit'];
    const passed = expected.every(e => receivedEvents.includes(e));
    
    if (passed) {
        console.log('\n✅ VERIFICATION PASSED: All core resonance events emitted.');
    } else {
        console.log('\n❌ VERIFICATION FAILED: Missing events.');
        console.log('Expected:', expected);
    }
    
    unsubscribe();
    process.exit(passed ? 0 : 1);
}

runTest().catch(err => {
    console.error('Test crashed:', err);
    process.exit(1);
});
