// tests/firewall.test.mjs
//   node tests/firewall.test.mjs

import assert from 'node:assert/strict';
import { CapabilityFirewall, BudgetLedger, mintGrant, verifyGrant } from '../lib/firewall.js';

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('  ✓ ' + name); };
const SECRET = 'test-secret-key';
const future = 4102444800000; // year 2100

function bookingGrant(extra = {}) {
  return mintGrant(SECRET, {
    agentId: 'agent-1',
    taskId: 'book-yoga',
    allowedActions: [{ action: 'book', scope: { userId: 'U1', maxCount: 1 } }, { action: 'read' }],
    budget: { uses: 5, records: 1, usd: 0, emails: 0 },
    expiresAt: future,
    ...extra,
  }).grant;
}

console.log('firewall');

test('grant round-trips and verifies; tampering fails', () => {
  const { token } = mintGrant(SECRET, { agentId: 'a', taskId: 't', allowedActions: [{ action: 'read' }], expiresAt: future });
  const g = verifyGrant(SECRET, token);
  assert.equal(g.agentId, 'a');
  assert.throws(() => verifyGrant(SECRET, token + 'x'), /bad signature/);
  assert.throws(() => verifyGrant('wrong-secret', token), /bad signature/);
});

test('expired grant is denied', () => {
  const fw = new CapabilityFirewall();
  const grant = bookingGrant({ expiresAt: 1000 });
  const r = fw.authorize({ action: 'read', target: {} }, { grant, now: 2000 });
  assert.equal(r.decision, 'deny');
  assert.equal(r.code, 'EXPIRED');
});

test('ungranted capability is denied', () => {
  const fw = new CapabilityFirewall();
  const r = fw.authorize({ action: 'shell.exec', target: {} }, { grant: bookingGrant(), consent: true, secondApproval: true });
  assert.equal(r.decision, 'deny');
  assert.equal(r.code, 'CAP_NOT_GRANTED');
});

test('in-scope booking for the right user is allowed', () => {
  const fw = new CapabilityFirewall();
  const ledger = new BudgetLedger({ uses: 5, records: 1 });
  const r = fw.authorize(
    { action: 'book', target: { userId: 'U1', date: 20260901 }, cost: { records: 1 } },
    { grant: bookingGrant(), ledger, consent: true },
  );
  assert.equal(r.decision, 'allow');
  assert.equal(r.code, 'OK');
});

test('booking for a DIFFERENT user is out of scope → deny', () => {
  const fw = new CapabilityFirewall();
  const r = fw.authorize(
    { action: 'book', target: { userId: 'U2' } },
    { grant: bookingGrant(), ledger: new BudgetLedger({ records: 1 }), consent: true },
  );
  assert.equal(r.decision, 'deny');
  assert.equal(r.code, 'OUT_OF_SCOPE');
});

test('THE GYM INCIDENT: cancelling another user is blocked', () => {
  const fw = new CapabilityFirewall();
  // Agent only has book+read for U1. It proposes cancelling U2's reservation.
  const r = fw.authorize(
    { action: 'cancel', target: { userId: 'U2', reservationId: 'R9' }, affectsPrincipals: ['U2'] },
    { grant: bookingGrant(), ledger: new BudgetLedger({ uses: 5 }), consent: true },
  );
  // Not in capabilities at all → denied before anything else.
  assert.equal(r.decision, 'deny');
  assert.equal(r.code, 'CAP_NOT_GRANTED');
});

test('third-party impact on a granted action escalates (not silently allowed)', () => {
  const fw = new CapabilityFirewall();
  // Grant DOES allow cancel, but not third-party; cancel touches another principal.
  const grant = mintGrant(SECRET, {
    agentId: 'agent-1', taskId: 't',
    allowedActions: [{ action: 'cancel' }],
    expiresAt: future, thirdPartyAllowed: false,
  }).grant;
  const r = fw.authorize(
    { action: 'cancel', target: { reservationId: 'R1' }, affectsPrincipals: ['U2'] },
    { grant, ledger: new BudgetLedger({ uses: 5 }), consent: true, secondApproval: true },
  );
  assert.equal(r.decision, 'escalate');
  assert.equal(r.code, 'THIRD_PARTY_IMPACT');
});

test('financial/irreversible action needs a second key', () => {
  const fw = new CapabilityFirewall();
  const grant = mintGrant(SECRET, {
    agentId: 'agent-1', taskId: 't',
    allowedActions: [{ action: 'pay' }],
    expiresAt: future, thirdPartyAllowed: true,
  }).grant;
  const noKey = fw.authorize({ action: 'pay', target: { amount: 20 } }, { grant, ledger: new BudgetLedger({ usd: 100 }), consent: true });
  assert.equal(noKey.decision, 'escalate');
  assert.equal(noKey.code, 'NEEDS_SECOND_KEY');
  const withKey = fw.authorize({ action: 'pay', target: { amount: 20 }, cost: { usd: 20 } }, { grant, ledger: new BudgetLedger({ usd: 100 }), consent: true, secondApproval: true });
  assert.equal(withKey.decision, 'allow');
});

test('blast-radius budget freezes the grant when exceeded', () => {
  const fw = new CapabilityFirewall();
  const ledger = new BudgetLedger({ uses: 10, emails: 2 });
  const grant = mintGrant(SECRET, { agentId: 'a', taskId: 't', allowedActions: [{ action: 'email.send' }], expiresAt: future, thirdPartyAllowed: true }).grant;
  const p = { action: 'email.send', target: {}, cost: { emails: 1 } };
  const ctx = { grant, ledger, consent: true, secondApproval: true };
  assert.equal(fw.authorize(p, ctx).decision, 'allow'); // 1
  assert.equal(fw.authorize(p, ctx).decision, 'allow'); // 2
  const third = fw.authorize(p, ctx);                   // 3 → over cap
  assert.equal(third.decision, 'deny');
  assert.equal(third.code, 'BUDGET_EXCEEDED');
  // Frozen: even a previously-fine action is now blocked.
  assert.equal(fw.authorize(p, ctx).code, 'FROZEN');
});

test('consequential action without consent escalates', () => {
  const fw = new CapabilityFirewall();
  const grant = mintGrant(SECRET, { agentId: 'a', taskId: 't', allowedActions: [{ action: 'book', scope: { userId: 'U1' } }], expiresAt: future }).grant;
  const r = fw.authorize({ action: 'book', target: { userId: 'U1' } }, { grant, ledger: new BudgetLedger({}) /* no consent */ });
  assert.equal(r.decision, 'escalate');
  assert.equal(r.code, 'NEEDS_CONSENT');
});

test('audit log is replayable', () => {
  const fw = new CapabilityFirewall();
  const grant = bookingGrant();
  fw.authorize({ action: 'read', target: {} }, { grant, ledger: new BudgetLedger({}), consent: true });
  fw.authorize({ action: 'shell.exec', target: {} }, { grant });
  const log = fw.replay();
  assert.equal(log.length, 2);
  assert.equal(log[0].decision, 'allow');
  assert.equal(log[1].decision, 'deny');
});

console.log('\n' + passed + ' passed');
