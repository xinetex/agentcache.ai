// tests/identity-verifier.test.mjs
//   node tests/identity-verifier.test.mjs

import assert from 'node:assert/strict';
import { IdentityVerifier } from '../lib/identity-verifier.js';

let passed = 0;
const test = async (n, f) => { await f(); passed++; console.log('  ✓ ' + n); };

console.log('identity-verifier');

(async () => {
  await test('IdentityVerifier signs and verifies inter-agent messages', async () => {
    const verifier = new IdentityVerifier();
    verifier.registerAgentIdentity('trusted_agent_1');

    const message = { instruction: 'Deploy schema patch', targetNode: 'db-replica-2' };
    const { signature, timestamp } = verifier.signMessage('trusted_agent_1', message);

    assert.ok(signature.startsWith('ed_sig_'));

    // Verify valid signature
    const check = verifier.verifySignature('trusted_agent_1', message, signature, timestamp);
    assert.equal(check.valid, true);
    assert.equal(check.agentId, 'trusted_agent_1');
  });

  await test('IdentityVerifier blocks impersonation and tampered payloads', async () => {
    const verifier = new IdentityVerifier();
    verifier.registerAgentIdentity('trusted_agent_1');
    verifier.registerAgentIdentity('rogue_agent_2');

    const legitMessage = { action: 'READ_ONLY_STATUS' };
    const { signature, timestamp } = verifier.signMessage('trusted_agent_1', legitMessage);

    // 1. Rogue agent tries to present trusted signature with modified payload
    const tamperedMessage = { action: 'DROP_TABLE_USERS' };
    const tamperCheck = verifier.verifySignature('trusted_agent_1', tamperedMessage, signature, timestamp);
    assert.equal(tamperCheck.valid, false);
    assert.ok(tamperCheck.error.includes('failed'));

    // 2. Unregistered agent ID fails
    const unregCheck = verifier.verifySignature('unknown_intruder', legitMessage, signature, timestamp);
    assert.equal(unregCheck.valid, false);
  });

  console.log('\n' + passed + ' passed');
})();
