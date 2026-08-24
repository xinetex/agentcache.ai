// tests/reasoning-cache.test.mjs
//   node tests/reasoning-cache.test.mjs
//
// The moat's contract: same task -> same key (resumable), state accumulates and
// dedupes across runs, relevance ranking is deterministic, and carried context
// stays bounded.

import assert from 'node:assert/strict';
import {
  normalizeTask, taskFingerprint, makeKey, mergeState,
  relevanceScore, selectRelevant, summarizeCarry,
} from '../lib/reasoning-cache.js';

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('  ✓ ' + name); };

console.log('reasoning-cache');

test('equivalent tasks (key order) hash identically -> resumable', () => {
  const a = taskFingerprint({ repo: 'x', goal: 'refactor', branch: 'main' });
  const b = taskFingerprint({ branch: 'main', goal: 'refactor', repo: 'x' });
  assert.equal(a, b);
  assert.equal(a.length, 16);
});

test('different tasks hash differently', () => {
  assert.notEqual(taskFingerprint('summarize repo'), taskFingerprint('summarize repo 2'));
});

test('string task normalizes with trim', () => {
  assert.equal(normalizeTask('  hello  '), 'hello');
});

test('key is tenant + agent + task isolated and separator-safe', () => {
  const k = makeKey({ orgSlug: 'acme', namespace: 'repo:a', agentId: 'planner 1', taskHash: 'deadbeef' });
  assert.equal(k, 'acme:repo_a:reason:planner_1:deadbeef');
});

test('mergeState accumulates and dedupes facts/decisions, bumps runs', () => {
  const r1 = mergeState(null, { facts: ['db is postgres', 'auth uses jwt'], decisions: ['use drizzle'] }, '2026-08-24');
  assert.equal(r1.runs, 1);
  const r2 = mergeState(r1, { facts: ['auth uses jwt', 'redis for cache'], decisions: ['use drizzle', 'lazy redis'] }, '2026-08-25');
  assert.equal(r2.runs, 2);
  assert.deepEqual(r2.facts, ['db is postgres', 'auth uses jwt', 'redis for cache']); // jwt not duplicated
  assert.deepEqual(r2.decisions, ['use drizzle', 'lazy redis']);
  assert.equal(r2.updatedAt, '2026-08-25');
});

test('scratch is shallow-merged, latest wins', () => {
  const r = mergeState({ scratch: { step: 3, cursor: 'a' } }, { scratch: { cursor: 'b' } });
  assert.deepEqual(r.scratch, { step: 3, cursor: 'b' });
});

test('relevanceScore is symmetric-ish and rewards overlap', () => {
  assert.ok(relevanceScore('redis cache config', 'the redis cache is configured lazily') > 0);
  assert.equal(relevanceScore('', 'anything'), 0);
  assert.equal(relevanceScore('zzz', 'aaa bbb'), 0);
});

test('selectRelevant ranks and caps to k, drops zero-score', () => {
  const notes = [
    'redis is configured lazily to avoid cold crashes',
    'the invoice pipeline runs nightly',
    'redis cache TTL is 24 hours',
    'unrelated note about frontend colors',
  ];
  const top = selectRelevant(notes, 'redis cache ttl', { k: 2 });
  assert.equal(top.length, 2);
  assert.ok(top[0].score >= top[1].score);
  assert.ok(top[0].entry.toLowerCase().includes('redis'));
});

test('summarizeCarry bounds output by char budget and estimates tokens', () => {
  const state = mergeState(null, {
    facts: Array.from({ length: 200 }, (_, i) => `fact number ${i} about the system architecture`),
    decisions: Array.from({ length: 50 }, (_, i) => `decision ${i}`),
  }, 'now');
  const { carry, charsUsed, tokensApprox } = summarizeCarry(state, { maxChars: 1000 });
  assert.ok(charsUsed <= 1000);
  assert.ok(tokensApprox > 0);
  assert.ok(carry.facts.length < 200); // it truncated
  assert.ok(carry.decisions.length <= 20);
});

test('summarizeCarry with a query prefers relevant facts', () => {
  const state = mergeState(null, {
    facts: ['the deploy target is vercel', 'the mascot is a fox', 'vercel uses edge functions'],
  }, 'now');
  const { carry } = summarizeCarry(state, { maxChars: 100, query: 'vercel deploy' });
  assert.ok(carry.facts.join(' ').includes('vercel'));
});

console.log('\n' + passed + ' passed');
