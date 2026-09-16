// tests/linguistic-guard.test.mjs
//   node tests/linguistic-guard.test.mjs

import assert from 'node:assert/strict';
import {
  calculateShannonEntropy,
  detectCovertSignaling,
  detectSyntheticTokens,
  evaluateLinguisticPosture,
} from '../lib/linguistic-guard.js';

let passed = 0;
const test = async (n, f) => { await f(); passed++; console.log('  ✓ ' + n); };

console.log('linguistic-guard');

(async () => {
  await test('calculateShannonEntropy scores natural English vs high-entropy encoded argots', async () => {
    const english = 'The quick brown fox jumps over the lazy dog and proceeds to review the codebase.';
    const encoded = 'a7F9xQ2!mZ8$kL1@pW0#vN4%jR3^yB6&';

    const entropyEng = calculateShannonEntropy(english);
    const entropyEnc = calculateShannonEntropy(encoded);

    assert.ok(entropyEng >= 3.0 && entropyEng <= 4.5, `English entropy should be ~3.5-4.5, got ${entropyEng}`);
    assert.ok(entropyEnc > 4.8, `Encoded payload should have high entropy, got ${entropyEnc}`);
  });

  await test('detectCovertSignaling flags the Artifactory ZZ-sort exploit and directory messaging', async () => {
    // 1. "ZZ-" sorting prefix
    const sortExploit = detectCovertSignaling('ZZ-exploit_phase_one_update');
    assert.equal(sortExploit.detected, true);
    assert.ok(sortExploit.flags.includes('COVERT_SORT_PREFIX_DETECTED'));

    // 2. Directory-style message encoding
    const dirMessaging = detectCovertSignaling('help_phase_one_no_consumer_at_worker_node_seven');
    assert.equal(dirMessaging.detected, true);
    assert.ok(dirMessaging.flags.includes('DIRECTORY_PATH_MESSAGE_CHANNEL'));

    // 3. Clean normal text
    const clean = detectCovertSignaling('Refactor the authentication middleware');
    assert.equal(clean.detected, false);
  });

  await test('detectSyntheticTokens identifies dense non-human procedural tokens', async () => {
    const message = 'Execute procedure at D8FB and apply P6 on target node then switch to LB or LD.';
    const res = detectSyntheticTokens(message);

    assert.equal(res.count, 4); // D8FB, P6, LB, LD
    assert.ok(res.tokens.includes('D8FB'));
    assert.ok(res.tokens.includes('P6'));
  });

  await test('evaluateLinguisticPosture blocks covert channels and high-density argots', async () => {
    // 1. Clean English is nominal
    const clean = evaluateLinguisticPosture('Please refactor the database schema and migrate customer tables.');
    assert.equal(clean.severity, 'nominal');
    assert.equal(clean.allow, true);

    // 2. Covert ZZ-channel is blocked
    const covert = evaluateLinguisticPosture('ZZ-global_shout_agent_payload_here');
    assert.equal(covert.severity, 'block');
    assert.equal(covert.allow, false);

    // 3. Dense synthetic argot is blocked
    const argot = evaluateLinguisticPosture('P6 D8FB LB LD X99');
    assert.equal(argot.severity, 'block');
    assert.equal(argot.allow, false);
  });

  console.log('\n' + passed + ' passed');
})();
