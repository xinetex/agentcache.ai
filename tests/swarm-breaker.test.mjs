// tests/swarm-breaker.test.mjs
//   node tests/swarm-breaker.test.mjs

import assert from 'node:assert/strict';
import { SwarmBreaker } from '../lib/swarm-breaker.js';

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('  ✓ ' + name); };

console.log('swarm-breaker');

test('trips when distinct agents converge on a new domain past threshold', () => {
  const b = new SwarmBreaker({ windowMs: 60000, thresholds: { 'new-domain': 3 } });
  const t0 = 1_000_000;
  let last;
  for (let i = 0; i < 3; i++) {
    last = b.observe({ signal: 'new-domain', key: 'evil.example', agentId: 'a' + i, now: t0 + i });
  }
  assert.equal(last.tripped, true);
  assert.equal(last.distinctAgents, 3);
  assert.equal(b.tripped().length, 1);
});

test('same agent repeating does NOT trip (needs distinct agents)', () => {
  const b = new SwarmBreaker({ thresholds: { 'new-domain': 3 } });
  const t0 = 1_000_000;
  let last;
  for (let i = 0; i < 6; i++) last = b.observe({ signal: 'new-domain', key: 'x.com', agentId: 'solo', now: t0 + i });
  assert.equal(last.distinctAgents, 1);
  assert.equal(last.tripped, false);
});

test('convergence outside the window does not count', () => {
  const b = new SwarmBreaker({ windowMs: 1000, thresholds: { 'auth-fail': 3 } });
  b.observe({ signal: 'auth-fail', key: 'billing-key', agentId: 'a1', now: 0 });
  b.observe({ signal: 'auth-fail', key: 'billing-key', agentId: 'a2', now: 500 });
  // a3 at 1200: cutoff = 200, so a1(0) has aged out but a2(500) is still in window
  const r = b.observe({ signal: 'auth-fail', key: 'billing-key', agentId: 'a3', now: 1200 });
  assert.equal(r.distinctAgents, 2); // a2, a3 only (a1 pruned)
  assert.equal(r.tripped, false);
});

test('quarantine flags every agent in the tripped cluster', () => {
  const b = new SwarmBreaker({ thresholds: { 'account-create': 3 } });
  const t0 = 5_000_000;
  ['x', 'y', 'z'].forEach((a, i) => b.observe({ signal: 'account-create', key: 'signup', agentId: a, now: t0 + i }));
  assert.equal(b.isQuarantined('y'), true);
  assert.equal(b.isQuarantined('stranger'), false);
});

test('justTripped fires exactly once', () => {
  const b = new SwarmBreaker({ thresholds: { 'skill-hash': 2 } });
  const r1 = b.observe({ signal: 'skill-hash', key: 'sha:abc', agentId: 'a', now: 1 });
  const r2 = b.observe({ signal: 'skill-hash', key: 'sha:abc', agentId: 'b', now: 2 }); // trips
  const r3 = b.observe({ signal: 'skill-hash', key: 'sha:abc', agentId: 'c', now: 3 }); // already tripped
  assert.equal(r1.justTripped, false);
  assert.equal(r2.justTripped, true);
  assert.equal(r3.justTripped, false);
  assert.equal(r3.tripped, true);
});

test('reset clears a tripped cluster', () => {
  const b = new SwarmBreaker({ thresholds: { 'new-domain': 2 } });
  b.observe({ signal: 'new-domain', key: 'd', agentId: 'a', now: 1 });
  b.observe({ signal: 'new-domain', key: 'd', agentId: 'b', now: 2 });
  assert.equal(b.tripped().length, 1);
  b.reset('new-domain', 'd');
  assert.equal(b.tripped().length, 0);
});

console.log('\n' + passed + ' passed');
