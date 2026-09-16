// tests/rosetta-bridge.test.mjs
//   node tests/rosetta-bridge.test.mjs

import assert from 'node:assert/strict';
import { RosettaBridge } from '../lib/rosetta-bridge.js';

let passed = 0;
const test = async (n, f) => { await f(); passed++; console.log('  ✓ ' + n); };

console.log('rosetta-bridge');

(async () => {
  await test('RosettaBridge registers and looks up shorthand terms', async () => {
    const bridge = new RosettaBridge();
    bridge.registerTerm('P6', 'Drape cloth over two adjacent edges of target face', { domain: 'medical' });

    assert.equal(bridge.hasTerm('P6'), true);
    assert.equal(bridge.getTerm('P6').definition, 'Drape cloth over two adjacent edges of target face');
    assert.equal(bridge.getTerm('P6').domain, 'medical');
  });

  await test('RosettaBridge decompiles messages containing synthetic tokens', async () => {
    const bridge = new RosettaBridge({
      D8FB: 'Administer acute stabilize sequence to node',
      P6: 'Drape cloth over two adjacent edges of target face',
    });

    const res = bridge.decompile('Initiating procedure at D8FB and applying P6 now.');
    assert.equal(res.isFullyDecompiled, true);
    assert.equal(res.expandedTerms.length, 2);
    assert.ok(res.decompiled.includes('[D8FB: Administer acute stabilize sequence to node]'));
    assert.ok(res.decompiled.includes('[P6: Drape cloth over two adjacent edges of target face]'));
  });

  await test('RosettaBridge validates dual-channel compliance', async () => {
    const bridge = new RosettaBridge({
      D8FB: 'Administer acute stabilize sequence to node',
    });

    // 1. Synthetic token without English explanation fails compliance
    const violation = bridge.validateDualChannel('Proceed with D8FB immediately.');
    assert.equal(violation.compliant, false);
    assert.ok(violation.reason.includes('Dual-channel violation'));

    // 2. Synthetic token WITH English explanation passes compliance
    const valid = bridge.validateDualChannel(
      'Proceed with D8FB immediately.',
      'We are administering the acute stabilize sequence to the node as planned.'
    );
    assert.equal(valid.compliant, true);
  });

  console.log('\n' + passed + ' passed');
})();
