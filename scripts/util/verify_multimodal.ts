import { RosNode, SensorData } from './src/edge/RosNode.js';

async function runMultimodalTest() {
    console.log('--- Testing Multi-Modal Embodied Generalization (Stage 6) ---');
    console.log('Scenario: Robot learns to avoid a "Red Chair". Can it recognize a "Blue Chair"?');

    const robot = new RosNode('Robot_G');

    // 1. ENCOUNTER: Red Chair
    const objA = { label: 'chair', color: 'red' };
    console.log(`\n1. Encounter: ${JSON.stringify(objA)}`);
    console.log('   Action: Compute & Learn');

    const actionA = await robot.process({
        type: 'camera',
        payload: objA,
        timestamp: Date.now()
    });

    console.log(`   Result: ${actionA.command} (Source: ${actionA.source})`);

    if (actionA.source !== 'compute') {
        console.error('❌ Expected COMPUTE for first encounter');
        return;
    }

    // 2. ENCOUNTER: Blue Chair (Variant)
    // The "Visual Encoder" should place this close to Red Chair
    const objB = { label: 'chair', color: 'blue' };
    console.log(`\n2. Encounter: ${JSON.stringify(objB)}`);
    console.log('   Action: Expect Semantic Recall (Generalization)');

    const actionB = await robot.process({
        type: 'camera',
        payload: objB,
        timestamp: Date.now()
    });

    console.log(`   Result: ${actionB.command} (Source: ${actionB.source})`);

    if (actionB.source === 'cache') {
        console.log('✅ SUCCESS: Robot generalized "Chair" concept across colors!');
    } else {
        console.error('❌ FAILURE: Robot failed to generalize. Treated Blue Chair as unknown.');
    }

    // 3. ENCOUNTER: Blue Table (Different Class)
    const objC = { label: 'table', color: 'blue' };
    console.log(`\n3. Encounter: ${JSON.stringify(objC)}`);
    console.log('   Action: Expect Compute (Discrimination)');

    const actionC = await robot.process({
        type: 'camera',
        payload: objC,
        timestamp: Date.now()
    });
    console.log(`   Result: ${actionC.command} (Source: ${actionC.source})`);

    if (actionC.source === 'compute') {
        console.log('✅ SUCCESS: Robot correctly discriminated Table from Chair.');
    } else {
        console.error('❌ FAILURE: Robot confused Table with Chair.');
    }
}

runMultimodalTest();
