// tests/grounded-verifier.test.mjs
//   node tests/grounded-verifier.test.mjs

import assert from 'node:assert/strict';
import {
  validateNamespaceBoundary,
  sanitizeToolArguments,
  verifyStateInvariants,
  createGroundedReceipt,
} from '../lib/grounded-verifier.js';

let passed = 0;
const test = async (n, f) => { await f(); passed++; console.log('  ✓ ' + n); };

console.log('grounded-verifier');

(async () => {
  await test('validateNamespaceBoundary enforces tenant isolation and blocks ZZ- sort hacks', async () => {
    // 1. Blocks ZZ- sort prefix hack from Artifactory incident
    const sortHack = validateNamespaceBoundary('ZZ-exploit_mailbox', 'tenant_a');
    assert.equal(sortHack.valid, false);
    assert.ok(sortHack.error.includes('Covert sort prefix'));

    // 2. Properly namespaces clean key
    const clean = validateNamespaceBoundary('auth_session_facts', 'tenant_a');
    assert.equal(clean.valid, true);
    assert.equal(clean.namespacedKey, 'tenant_a:auth_session_facts');
  });

  await test('sanitizeToolArguments catches SSRF metadata endpoints and Jinja2 template injections', async () => {
    // 1. SSRF metadata attempt
    const ssrf = sanitizeToolArguments({ url: 'http://169.254.169.254/latest/meta-data/iam' });
    assert.equal(ssrf.safe, false);
    assert.ok(ssrf.violations[0].includes('SSRF attempt'));

    // 2. Jinja2 template injection attempt
    const tpl = sanitizeToolArguments({ template: 'Hello {{ config.items() }}' });
    assert.equal(tpl.safe, false);
    assert.ok(tpl.violations[0].includes('Template injection'));

    // 3. Unsafe file:// protocol
    const proto = sanitizeToolArguments({ path: 'file:///etc/passwd' });
    assert.equal(proto.safe, false);
    assert.ok(proto.violations[0].includes('Unsafe protocol schema'));

    // 4. Clean arguments pass
    const clean = sanitizeToolArguments({ query: 'SELECT id, name FROM users WHERE active = true', limit: 10 });
    assert.equal(clean.safe, true);
    assert.equal(clean.violations.length, 0);
  });

  await test('verifyStateInvariants validates pre/post execution assertions', async () => {
    const pre = { step: 1, spentUsd: 1.00 };
    const postValid = { step: 2, spentUsd: 1.50 };
    const postInvalid = { step: 2, spentUsd: 15.00 };

    const assertions = [
      { type: 'step_monotonic' },
      { type: 'budget_not_exceeded', maxBudgetUsd: 10.00 },
    ];

    const validRes = verifyStateInvariants(pre, postValid, assertions);
    assert.equal(validRes.valid, true);

    const invalidRes = verifyStateInvariants(pre, postInvalid, assertions);
    assert.equal(invalidRes.valid, false);
    assert.ok(invalidRes.failures[0].includes('Budget invariant breached'));
  });

  await test('createGroundedReceipt emits cryptographically signed tamper-evident receipt', async () => {
    const receipt = createGroundedReceipt({
      runId: 'run_42',
      agentId: 'reviewer',
      namespace: 'production',
      step: 1,
      intent: 'Refactor auth middleware',
      spentUsd: 0.15,
      savedUsd: 0.05,
    });

    assert.ok(receipt.receiptId.startsWith('rcpt_'));
    assert.ok(receipt.signature.startsWith('grnd_sha256_'));
    assert.equal(receipt.runId, 'run_42');
    assert.equal(receipt.invariantsPassed, true);
  });

  console.log('\n' + passed + ' passed');
})();
