// tests/savings-recorder.test.mjs
//   node tests/savings-recorder.test.mjs
//
// Proves the hit -> (model, layer, savedTokens, savedUsd) wire, and that the
// ledger writer fails open and rolls into the daily aggregate.

import assert from 'node:assert/strict';
import {
  savingsFromHit,
  savedTokensFor,
  recordHit,
  hitEventFromHeaders,
} from '../lib/savings-recorder.js';

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('  ✓ ' + name); };
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} !~= ${b}`);

console.log('savings-recorder');

test('exact hit captures model, layer, savedTokens and priced savedUsd', () => {
  const s = savingsFromHit({ layer: 'exact', model: 'claude-opus-5', inputTokens: 10000, outputTokens: 2000 });
  assert.equal(s.layer, 'exact');
  assert.equal(s.model, 'claude-opus-5');
  assert.equal(s.savedTokens, 12000);
  near(s.savedUsd, 0.10);
  assert.equal(s.valued, true);
});

test('prefix hit savedTokens is the prefix length; priced at cache-read discount', () => {
  const s = savingsFromHit({ layer: 'prefix', model: 'claude-opus-5', prefixTokens: 20000 });
  assert.equal(s.savedTokens, 20000);
  near(s.savedUsd, 0.09);
});

test('reasoning hit is valued as an avoided input-side call', () => {
  // reasoning re-uses 5k carried tokens on sonnet-5 ($2/MTok in) => 0.01
  const s = savingsFromHit({ layer: 'reasoning', model: 'claude-sonnet-5', inputTokens: 5000 });
  assert.equal(s.layer, 'reasoning');
  assert.equal(s.savedTokens, 5000);
  near(s.savedUsd, 0.01);
});

test('unknown model records the hit but never overstates ($0, valued:false)', () => {
  const s = savingsFromHit({ layer: 'exact', model: 'mystery-9', inputTokens: 9999, outputTokens: 9999 });
  assert.equal(s.savedUsd, 0);
  assert.equal(s.valued, false);
  assert.equal(s.savedTokens, 19998); // hit-rate stays honest even when unpriced
});

test('bad layer falls back to exact, missing model -> "unknown"', () => {
  const s = savingsFromHit({ inputTokens: 1000 });
  assert.equal(s.layer, 'exact');
  assert.equal(s.model, 'unknown');
});

test('savedTokensFor covers every layer', () => {
  assert.equal(savedTokensFor({ layer: 'semantic', inputTokens: 3, outputTokens: 4 }), 7);
  assert.equal(savedTokensFor({ layer: 'prefix', prefixTokens: 11 }), 11);
  assert.equal(savedTokensFor({ layer: 'reasoning', inputTokens: 6 }), 6);
  assert.equal(savedTokensFor({ layer: 'nope' }), 0);
});

test('hitEventFromHeaders reads model + token headers (case-insensitive)', () => {
  const h = new Map([['x-model', 'gpt-5.2'], ['x-input-tokens', '8000'], ['x-output-tokens', '1000']]);
  const ev = hitEventFromHeaders({ get: (k) => h.get(k) }, 'exact');
  assert.equal(ev.model, 'gpt-5.2');
  assert.equal(ev.inputTokens, 8000);
  assert.equal(ev.outputTokens, 1000);
});

// --- recordHit: injected fakes, verifies ledger row + aggregate + fail-open ---
{
  const calls = { sql: [], usage: [] };
  const fakeSql = (strings, ...vals) => { calls.sql.push(vals); return Promise.resolve([]); };
  const fakeRecordUsage = (org, ns, metrics) => { calls.usage.push({ org, ns, metrics }); return Promise.resolve(); };

  const s = await recordHit(
    { sql: fakeSql, recordUsage: fakeRecordUsage },
    { organizationId: 'org-1', namespace: 'repoA', event: { layer: 'prefix', model: 'claude-opus-5', prefixTokens: 20000 }, sessionId: 'sess-9' },
  );
  test('recordHit writes a ledger row and rolls the daily aggregate', () => {
    assert.equal(calls.sql.length, 1, 'one ledger insert');
    assert.ok(calls.sql[0].includes('org-1'));
    assert.ok(calls.sql[0].includes('claude-opus-5'));
    assert.equal(calls.usage.length, 1, 'one aggregate update');
    near(calls.usage[0].metrics.costSaved, 0.09);
    assert.equal(calls.usage[0].metrics.tokens, 20000);
    assert.equal(s.savedUsd, 0.09);
  });
}
{
  const throwingSql = () => { throw new Error('db down'); };
  const r = await recordHit({ sql: throwingSql, recordUsage: () => {} }, { organizationId: 'o', namespace: 'n', event: { layer: 'exact', model: 'claude-opus-5', inputTokens: 1 } });
  test('recordHit fails OPEN when the ledger write throws (returns null, no throw)', () => {
    assert.equal(r, null);
  });
}
{
  const r = await recordHit({ sql: () => Promise.resolve([]), recordUsage: () => {} }, { namespace: 'n', event: {} });
  test('recordHit ignores incomplete payloads (no org id)', () => {
    assert.equal(r, null);
  });
}

console.log('\n' + passed + ' passed');
