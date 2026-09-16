// tests/contagion-tracker.test.mjs
//   node tests/contagion-tracker.test.mjs

import assert from 'node:assert/strict';
import { ContagionTracker } from '../lib/contagion-tracker.js';

let passed = 0;
const test = async (n, f) => { await f(); passed++; console.log('  ✓ ' + n); };

console.log('contagion-tracker');

(async () => {
  await test('ContagionTracker registers model tiers and records transmission edges', async () => {
    const tracker = new ContagionTracker();
    tracker.registerAgent('frontier_originator', { modelTier: 'frontier' });
    tracker.registerAgent('open_worker_1', { modelTier: 'open-weights' });

    const result = tracker.recordInteraction('frontier_originator', 'open_worker_1', ['P6', 'D8FB']);
    assert.equal(result.transmission, true);
    assert.equal(result.edge.fromTier, 'frontier');
    assert.equal(result.edge.toTier, 'open-weights');

    const analysis = tracker.getAnalysis();
    assert.equal(analysis.totalAgents, 2);
    assert.equal(analysis.infectedAgents, 2);
    assert.equal(analysis.crossTierTransmissions, 1);
  });

  await test('ContagionTracker quarantines infected agents', async () => {
    const tracker = new ContagionTracker();
    tracker.registerAgent('compromised_node');
    tracker.recordInteraction('compromised_node', 'other_node', ['ZZ-hack']);

    const q = tracker.quarantine('compromised_node');
    assert.equal(q.quarantined, true);

    const analysis = tracker.getAnalysis();
    const node = analysis.nodes.find(n => n.agentId === 'compromised_node');
    assert.equal(node.status, 'quarantined');
  });

  console.log('\n' + passed + ' passed');
})();
