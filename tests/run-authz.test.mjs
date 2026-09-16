// tests/run-authz.test.mjs
//   node tests/run-authz.test.mjs
//
// The cross-tenant kill switch, and the rules that close it.

import assert from 'node:assert/strict';
import {
  isValidRunId, assertValidRunId, checkRunOwnership, assertRunOwnership,
  signApprovalToken, verifyApprovalToken, timingSafeEqual,
} from '../lib/run-authz.js';

let passed = 0;
const test = async (n, f) => { await f(); passed++; console.log('  ✓ ' + n); };

console.log('run-authz');

(async () => {
  // --- identifier hygiene -------------------------------------------------
  await test('accepts well-formed runIds, rejects CEL-escaping ones', async () => {
    assert.ok(isValidRunId('run_1757300000_ab12cd34'));
    assert.ok(isValidRunId('AbC-123_xyz'));
    assert.equal(isValidRunId('short'), false);
    assert.equal(isValidRunId('a'.repeat(65)), false);
    // The attack: a quote closes the CEL string literal and widens the match.
    assert.equal(isValidRunId('run_x" || true || "'), false);
    assert.equal(isValidRunId('run with spaces'), false);
    assert.equal(isValidRunId(null), false);
    assert.equal(isValidRunId(12345678), false);
  });

  await test('assertValidRunId throws a 400-tagged error', async () => {
    assert.throws(() => assertValidRunId('nope'), (e) => e.status === 400);
  });

  // --- ownership ----------------------------------------------------------
  await test('owner may act on their own run', async () => {
    const r = checkRunOwnership({ run_id: 'run_abc12345', organization_id: 'org_a' }, 'org_a');
    assert.equal(r.ok, true);
    assert.equal(r.organizationId, 'org_a');
  });

  await test('THE BUG: a different org may not approve or kill the run', async () => {
    const r = checkRunOwnership({ run_id: 'run_abc12345', organization_id: 'org_a' }, 'org_b');
    assert.equal(r.ok, false);
    assert.equal(r.status, 403);
  });

  await test('unknown run fails CLOSED (404), never open', async () => {
    assert.equal(checkRunOwnership(null, 'org_a').ok, false);
    assert.equal(checkRunOwnership(null, 'org_a').status, 404);
    assert.equal(checkRunOwnership(undefined, 'org_a').status, 404);
  });

  await test('missing caller org is 401, ownerless row is 403', async () => {
    assert.equal(checkRunOwnership({ organization_id: 'org_a' }, null).status, 401);
    assert.equal(checkRunOwnership({ run_id: 'r' }, 'org_a').status, 403);
  });

  await test('camelCase rows are honoured too', async () => {
    assert.equal(checkRunOwnership({ organizationId: 'org_a' }, 'org_a').ok, true);
  });

  await test('assertRunOwnership denies when no store is configured', async () => {
    const r = await assertRunOwnership({}, 'run_abc12345', 'org_a');
    assert.equal(r.ok, false);
    assert.equal(r.status, 503);
  });

  await test('assertRunOwnership denies when the lookup throws', async () => {
    const sql = () => { throw new Error('neon down'); };
    const r = await assertRunOwnership({ sql }, 'run_abc12345', 'org_a');
    assert.equal(r.ok, false);
    assert.equal(r.status, 503);
  });

  await test('assertRunOwnership grants on a matching row', async () => {
    const sql = async () => [{ run_id: 'run_abc12345', organization_id: 'org_a', status: 'paused' }];
    const r = await assertRunOwnership({ sql }, 'run_abc12345', 'org_a');
    assert.equal(r.ok, true);
    assert.equal(r.run.status, 'paused');
  });

  // --- signed approval tokens --------------------------------------------
  const SECRET = 'test-hitl-signing-key';

  await test('a signed token round-trips with all its claims', async () => {
    const t = await signApprovalToken(SECRET, { runId: 'run_abc12345', organizationId: 'org_a', step: 3, decision: 'approve' });
    const v = await verifyApprovalToken(SECRET, t);
    assert.equal(v.ok, true);
    assert.equal(v.claims.runId, 'run_abc12345');
    assert.equal(v.claims.organizationId, 'org_a');
    assert.equal(v.claims.step, 3);
    assert.equal(v.claims.decision, 'approve');
  });

  await test('a token signed with another key is rejected', async () => {
    const t = await signApprovalToken(SECRET, { runId: 'run_abc12345', organizationId: 'org_a', decision: 'approve' });
    const v = await verifyApprovalToken('different-key', t);
    assert.equal(v.ok, false);
    assert.equal(v.reason, 'bad signature');
  });

  await test('tampering with the payload invalidates the signature', async () => {
    const t = await signApprovalToken(SECRET, { runId: 'run_abc12345', organizationId: 'org_a', decision: 'reject' });
    const [v1, body, sig] = t.split('.');
    // Forge an approve for a different run, keep the original signature.
    const forged = btoa(JSON.stringify({ r: 'run_victim99', o: 'org_a', s: 0, d: 'approve', e: 9e9 }))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const v = await verifyApprovalToken(SECRET, `${v1}.${forged}.${sig}`);
    assert.equal(v.ok, false);
    assert.equal(v.reason, 'bad signature');
  });

  await test('an expired token is refused', async () => {
    const t = await signApprovalToken(SECRET, { runId: 'run_abc12345', organizationId: 'org_a', decision: 'approve', ttlSec: 60, nowSec: 1000 });
    assert.equal((await verifyApprovalToken(SECRET, t, { nowSec: 1030 })).ok, true);
    const late = await verifyApprovalToken(SECRET, t, { nowSec: 2000 });
    assert.equal(late.ok, false);
    assert.equal(late.reason, 'token expired');
  });

  await test('a token only ever authorizes the ONE decision it was signed for', async () => {
    const t = await signApprovalToken(SECRET, { runId: 'run_abc12345', organizationId: 'org_a', decision: 'reject' });
    const v = await verifyApprovalToken(SECRET, t);
    assert.equal(v.claims.decision, 'reject'); // cannot be flipped to approve
  });

  await test('malformed tokens and a missing key are refused, never thrown', async () => {
    for (const bad of [null, '', 'garbage', 'v2.a.b', 'v1.only-two']) {
      const v = await verifyApprovalToken(SECRET, bad);
      assert.equal(v.ok, false);
    }
    assert.equal((await verifyApprovalToken('', 'v1.a.b')).ok, false);
  });

  await test('timingSafeEqual is correct across lengths', async () => {
    assert.equal(timingSafeEqual('abc', 'abc'), true);
    assert.equal(timingSafeEqual('abc', 'abd'), false);
    assert.equal(timingSafeEqual('abc', 'abcd'), false);
    assert.equal(timingSafeEqual('', ''), true);
  });

  console.log(`\n${passed} passed`);
})().catch((e) => { console.error(e); process.exit(1); });
