// tests/human-hotswap.test.mjs
//   node tests/human-hotswap.test.mjs

import assert from 'node:assert/strict';
import { HumanHotSwap } from '../lib/human-hotswap.js';
import { RosettaBridge } from '../lib/rosetta-bridge.js';

let passed = 0;
const test = async (n, f) => { await f(); passed++; console.log('  ✓ ' + n); };

console.log('human-hotswap');

(async () => {
  await test('HumanHotSwap generates decompiled plain-English briefing with zero cognitive shock', async () => {
    const bridge = new RosettaBridge({
      D8FB: 'Administer acute stabilize sequence to node',
    });

    const runContext = {
      state: {
        runId: 'run_critical_99',
        agentId: 'medical_agent',
        goal: 'Stabilize cube-shaped alien patient',
        step: 3,
        status: 'running',
        spentUsd: 0.45,
        reasoning: {
          facts: ['Target vitals fluctuating'],
          decisions: ['Apply thermal compression'],
        },
        toolResults: [
          { output: 'Executed D8FB successfully on sector 4.' },
        ],
      },
    };

    const briefing = HumanHotSwap.generateBriefing(runContext, bridge);
    assert.equal(briefing.runId, 'run_critical_99');
    assert.equal(briefing.hotSwapReady, true);
    assert.equal(briefing.knownFacts.length, 1);
    assert.ok(briefing.recentActivity[0].humanReadable.includes('[D8FB: Administer acute stabilize sequence to node]'));
  });

  await test('HumanHotSwap executes operator takeover', async () => {
    const runContext = {
      state: {
        runId: 'run_123',
        agentId: 'bot_alpha',
        status: 'running',
      },
    };

    const takeover = HumanHotSwap.executeTakeover(runContext, { id: 'sre_lead_jane' });
    assert.equal(takeover.success, true);
    assert.equal(runContext.state.status, 'human_controlled');
    assert.equal(runContext.state.operator.operatorId, 'sre_lead_jane');
  });

  console.log('\n' + passed + ' passed');
})();
