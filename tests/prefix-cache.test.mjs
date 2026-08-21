// tests/prefix-cache.test.mjs
//
// Runnable two ways:
//   node tests/prefix-cache.test.mjs      (zero deps, plain assertions)
//   vitest                                (the describe/it shim below adapts)
//
// Tests the pure prefix-cache logic — no Redis, no network.

import assert from 'node:assert/strict';
import {
  estimateTokens,
  messageText,
  hashMessage,
  fingerprint,
  commonPrefixLength,
  computePrefixReuse,
  planBreakpoints,
} from '../lib/prefix-cache.js';

let passed = 0;
const test = (name, fn) => {
  fn();
  passed++;
  console.log('  ✓ ' + name);
};

const sys = { role: 'system', content: 'You are a coding agent. Follow the repo conventions.' };
const tools = { role: 'system', content: 'TOOLS: read_file, write_file, run_tests' };
const u1 = { role: 'user', content: 'Fix the failing test in auth.js' };
const a1 = { role: 'assistant', content: 'Looking at auth.js now...' };
const u2 = { role: 'user', content: 'Now add a regression test' };

console.log('prefix-cache');

test('estimateTokens ~ chars/4', () => {
  assert.equal(estimateTokens(''), 0);
  assert.equal(estimateTokens('abcd'), 1);
  assert.equal(estimateTokens('abcde'), 2);
});

test('messageText normalizes string and block-array content', () => {
  assert.equal(messageText({ role: 'user', content: 'hi' }), 'hi');
  assert.equal(messageText({ role: 'user', content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] }), 'a\nb');
  assert.equal(messageText({ role: 'user' }), '');
});

test('hashMessage is stable and role-sensitive', () => {
  assert.equal(hashMessage(u1), hashMessage({ ...u1 }));
  assert.notEqual(hashMessage(u1), hashMessage({ role: 'assistant', content: u1.content }));
});

test('cold session (no prior) is a miss', () => {
  const r = computePrefixReuse(null, [sys, tools, u1]);
  assert.equal(r.hit, false);
  assert.equal(r.reusableMessages, 0);
  assert.equal(r.breakpointIndex, -1);
  assert.equal(r.savedTokensApprox, 0);
});

test('identical turn reuses the full prefix', () => {
  const prev = fingerprint([sys, tools, u1]);
  const r = computePrefixReuse(prev, [sys, tools, u1]);
  assert.equal(r.hit, true);
  assert.equal(r.reusableMessages, 3);
  assert.equal(r.breakpointIndex, 2);
  assert.ok(r.savedTokensApprox > 0);
});

test('appended turn reuses prior prefix, breakpoint at prior end', () => {
  const prev = fingerprint([sys, tools, u1]);            // turn 1 fingerprint
  const now = [sys, tools, u1, a1, u2];                  // turn 2: same front + new msgs
  const r = computePrefixReuse(prev, now);
  assert.equal(r.hit, true);
  assert.equal(r.reusableMessages, 3);
  assert.equal(r.breakpointIndex, 2);
  assert.equal(r.totalMessages, 5);
});

test('changed system prompt busts the whole prefix', () => {
  const prev = fingerprint([sys, tools, u1]);
  const changedSys = { role: 'system', content: 'You are a DIFFERENT agent.' };
  const r = computePrefixReuse(prev, [changedSys, tools, u1]);
  assert.equal(r.hit, false);
  assert.equal(r.reusableMessages, 0);
});

test('minPrefixMessages gate suppresses tiny reuse', () => {
  const prev = fingerprint([sys, u1]);
  const now = [sys, { role: 'user', content: 'totally different' }];
  const r = computePrefixReuse(prev, now, { minPrefixMessages: 2 });
  assert.equal(r.reusableMessages, 1); // only sys matches
  assert.equal(r.hit, false);          // ...but gate requires >= 2
});

test('commonPrefixLength handles null/empty', () => {
  assert.equal(commonPrefixLength(null, ['a']), 0);
  assert.equal(commonPrefixLength(['a'], null), 0);
  assert.equal(commonPrefixLength(['a', 'b'], ['a', 'c']), 1);
});

test('planBreakpoints marks the breakpoint index, non-mutating', () => {
  const msgs = [sys, tools, u1, a1];
  const out = planBreakpoints(msgs, 1);
  assert.equal(out[1].cache_control.type, 'ephemeral');
  assert.equal(out[0].cache_control, undefined);
  assert.equal(msgs[1].cache_control, undefined, 'original must not be mutated');
});

test('planBreakpoints with -1 returns a copy unchanged', () => {
  const msgs = [sys, u1];
  const out = planBreakpoints(msgs, -1);
  assert.deepEqual(out, msgs);
  assert.notEqual(out, msgs); // new array
});

console.log('\n' + passed + ' passed');
