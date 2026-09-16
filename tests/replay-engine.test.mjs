// tests/replay-engine.test.mjs
//   node tests/replay-engine.test.mjs

import assert from 'node:assert/strict';
import { SimulationRecorder } from '../lib/replay-engine.js';

let passed = 0;
const test = async (n, f) => { await f(); passed++; console.log('  ✓ ' + n); };

console.log('replay-engine');

(async () => {
  await test('SimulationRecorder records discrete frames and updates environment state', async () => {
    const sim = new SimulationRecorder({
      seed: 'seed_42',
      environmentState: { temperature: 20, activeNodes: 3 },
    });

    sim.recordFrame({
      agentId: 'doctor_agent',
      rawMessage: 'Administer acute stabilize sequence',
      environmentDelta: { activeNodes: 4 },
    });

    sim.recordFrame({
      agentId: 'stranger_agent',
      rawMessage: 'Applying P6 drape now',
      environmentDelta: { targetStabilized: true },
    });

    assert.equal(sim.frames.length, 2);
    assert.equal(sim.environmentState.activeNodes, 4);
    assert.equal(sim.environmentState.targetStabilized, true);
  });

  await test('SimulationRecorder rewinds to specific turns with historical frames', async () => {
    const sim = new SimulationRecorder();
    sim.recordFrame({ rawMessage: 'Step 1' });
    sim.recordFrame({ rawMessage: 'Step 2' });
    sim.recordFrame({ rawMessage: 'Step 3' });

    const rewind = sim.rewindTo(1);
    assert.equal(rewind.stepIndex, 1);
    assert.equal(rewind.targetFrame.rawMessage, 'Step 2');
    assert.equal(rewind.historicalFrames.length, 2);
  });

  await test('SimulationRecorder forks counterfactual branches with interventions', async () => {
    const sim = new SimulationRecorder();
    sim.recordFrame({ rawMessage: 'Initial command' });
    sim.recordFrame({ rawMessage: 'Dangerous tool call', toolCalls: [{ tool: 'delete_db' }] });

    const branch = sim.forkBranch('safe_branch_1', 1, {
      overrideMessage: 'Safe query execution',
      overrideToolResult: { success: true, safe: true },
    });

    assert.equal(branch.branchId, 'safe_branch_1');
    assert.equal(branch.frames[1].rawMessage, 'Safe query execution');
    assert.equal(branch.frames[1].toolResults[0].safe, true);
  });

  await test('SimulationRecorder exports and imports traces deterministically', async () => {
    const sim = new SimulationRecorder({ seed: 'trace_test_seed' });
    sim.recordFrame({ rawMessage: 'Frame A' });
    sim.recordFrame({ rawMessage: 'Frame B' });

    const json = sim.exportTrace();
    const imported = SimulationRecorder.importTrace(json);

    assert.equal(imported.seed, 'trace_test_seed');
    assert.equal(imported.frames.length, 2);
    assert.equal(imported.frames[1].rawMessage, 'Frame B');
  });

  console.log('\n' + passed + ' passed');
})();
