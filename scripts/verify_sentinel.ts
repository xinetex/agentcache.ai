import { CognitiveEngine } from '../src/infrastructure/CognitiveEngine.js';
import { TrustCenter } from '../src/infrastructure/TrustCenter.js';

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

    console.log('\n--- Verifying Trust Center API ---');
    // We can't easily import TrustCenter here because it's in src/infrastructure
    // and this is a script. But we can verify CognitiveEngine.validateSystemState

    const systemState = await engine.validateSystemState();
    console.log('System State:', JSON.stringify(systemState, null, 2));

    if (systemState.valid) {
        console.log('✅ System State validation passed.');
    } else {
        console.error('❌ System State validation failed.');
    }

    if (systemState.details && systemState.details.node_version) {
        console.log('✅ Node version detected:', systemState.details.node_version);
    }

    console.log('\n--- Verifying TrustCenter Aggregation ---');
    const trustCenter = new TrustCenter();
    const status = await trustCenter.getTrustStatus();
    console.log('Trust Status:', JSON.stringify(status, null, 2));

    if (status.system.integrity && status.sentinel.active) {
        console.log('✅ TrustCenter aggregation working correctly.');
    } else {
        console.error('❌ TrustCenter aggregation failed.');
    }

    console.log('\n--- Verifying OSCAL Export ---');
    const oscal = await trustCenter.generateOSCAL();
    // console.log('OSCAL Output:', JSON.stringify(oscal, null, 2));

    const componentDef = oscal['component-definition'];
    if (componentDef && componentDef.metadata && componentDef.components) {
        console.log('✅ OSCAL structure valid.');

        const controls = componentDef.components[0]['control-implementations'][0]['implemented-requirements'];
        const integrityControl = controls.find((c: any) => c['control-id'] === 'SI-7');

        if (integrityControl) {
            console.log('✅ Found NIST Control SI-7 (Integrity):', integrityControl.props[0].value);
        } else {
            console.error('❌ Missing SI-7 Control');
        }
    } else {
        console.error('❌ Invalid OSCAL structure');
    }

    console.log('\n--- Verifying Government Mode Configuration ---');
    trustCenter.configureGovernmentMode({
        agency: 'Department of Energy',
        mission: 'Genesis Mission',
        impactLevel: 'IL4',
        compliance: { fedramp: true, hipaa: false, neutrality: true }
    });

    const govStatus = await trustCenter.getTrustStatus();
    if (govStatus.government && govStatus.government.impact_level === 'IL4') {
        console.log('✅ Government Mode configured successfully:', govStatus.government.agency);
    } else {
        console.error('❌ Government Mode configuration failed.');
    }
}

verifySentinel();
