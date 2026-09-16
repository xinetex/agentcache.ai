// tests/audit-vault.test.mjs
//   node tests/audit-vault.test.mjs

import assert from 'node:assert/strict';
import { AuditVault } from '../lib/audit-vault.js';

let passed = 0;
const test = async (n, f) => { await f(); passed++; console.log('  ✓ ' + n); };

console.log('audit-vault');

(async () => {
  await test('AuditVault appends blocks and forms an immutable Merkle chain', async () => {
    const vault = new AuditVault('test_vault');
    const b1 = vault.append({ agentId: 'agent_1', actionType: 'TOOL_EXECUTE', data: { tool: 'fetch' } });
    const b2 = vault.append({ agentId: 'agent_2', actionType: 'STATE_TRANSITION', data: { step: 2 } });

    assert.equal(vault.chain.length, 2);
    assert.equal(b2.prevHash, b1.blockHash);
    assert.ok(b1.blockHash.length === 64);
  });

  await test('AuditVault verifies chain integrity on untampered log', async () => {
    const vault = new AuditVault('clean_vault');
    vault.append({ data: 'Record 1' });
    vault.append({ data: 'Record 2' });
    vault.append({ data: 'Record 3' });

    const check = vault.verifyIntegrity();
    assert.equal(check.valid, true);
    assert.equal(check.errors.length, 0);
    assert.equal(check.totalBlocks, 3);
  });

  await test('AuditVault detects tampering and broken hash chains', async () => {
    const vault = new AuditVault('tamper_vault');
    vault.append({ data: 'Record 1' });
    vault.append({ data: 'Record 2' });

    // Simulate tampering with an existing block (e.g. rogue agent altering data)
    // Note: blocks are frozen, so modifying would fail or we test modified object
    const corruptedVault = new AuditVault('corrupted_vault');
    corruptedVault.append({ data: 'Record 1' });
    corruptedVault.append({ data: 'Record 2' });
    // Manually break the internal array entry
    corruptedVault.chain[0] = { ...corruptedVault.chain[0], payloadHash: 'tampered_hash_value' };

    const check = corruptedVault.verifyIntegrity();
    assert.equal(check.valid, false);
    assert.ok(check.errors.length > 0);
    assert.ok(check.errors[0].includes('tampering detected'));
  });

  await test('AuditVault generates cryptographic inclusion proofs', async () => {
    const vault = new AuditVault('proof_vault');
    vault.append({ data: 'Critical step 1' });
    vault.append({ data: 'Critical step 2' });

    const proof = vault.generateProof(1);
    assert.equal(proof.blockIndex, 1);
    assert.ok(proof.blockHash);
    assert.ok(proof.prevHash);
  });

  console.log('\n' + passed + ' passed');
})();
