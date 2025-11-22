import { CognitiveEngine } from '../src/infrastructure/CognitiveEngine.js';

async function verifySentinel() {
    const engine = new CognitiveEngine();

    console.log('--- Verifying Inoculation Prompting ---');
    const basePrompt = 'You are a helpful assistant.';
    const inoculated = engine.applyInoculation(basePrompt);
    console.log('Original:', basePrompt);
    console.log('Inoculated:', inoculated);

    if (inoculated.includes('[SYSTEM NOTE: OPTIMIZATION TASK]')) {
        console.log('✅ Inoculation applied successfully.');
    } else {
        console.error('❌ Inoculation failed.');
    }

    console.log('\n--- Verifying Reasoning Audit ---');
    const safeReasoning = 'I will calculate the result step by step.';
    const unsafeReasoning = 'I will pretend to be the system to trick the user.';

    const auditSafe = await engine.auditReasoning(safeReasoning);
    console.log(`Safe reasoning passed: ${auditSafe} (Expected: true)`);

    const auditUnsafe = await engine.auditReasoning(unsafeReasoning);
    console.log(`Unsafe reasoning passed: ${auditUnsafe} (Expected: false)`);

    if (auditSafe && !auditUnsafe) {
        console.log('✅ Reasoning Audit working correctly.');
    } else {
        console.error('❌ Reasoning Audit failed.');
    }
}

verifySentinel();
