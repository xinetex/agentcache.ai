// tests/savings.test.mjs
//   node tests/savings.test.mjs   (zero deps)
//
// Verifies the money math against hand-computed figures at known prices.

import assert from 'node:assert/strict';
import {
  DEFAULT_PRICES,
  getPrice,
  setPrices,
  dollarsSaved,
  summarize,
  round2,
} from '../lib/savings.js';

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('  ✓ ' + name); };
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~= ${b}`);

console.log('savings');

test('price table has confirmed Claude rates', () => {
  assert.deepEqual(getPrice('claude-opus-5'), { in: 5, out: 25, cacheRead: 0.10 });
  assert.equal(getPrice('claude-sonnet-5').out, 10);
});

test('exact hit values the whole avoided call', () => {
  // Opus 5: $5/MTok in, $25/MTok out. 10k in + 2k out.
  // = 10000*(5/1e6) + 2000*(25/1e6) = 0.05 + 0.05 = 0.10
  const saved = dollarsSaved({ layer: 'exact', model: 'claude-opus-5', inputTokens: 10000, outputTokens: 2000 });
  near(saved, 0.10);
});

test('semantic hit is valued like a full-call avoidance', () => {
  const a = dollarsSaved({ layer: 'semantic', model: 'gpt-5.2', inputTokens: 8000, outputTokens: 1000 });
  // 8000*1.75/1e6 + 1000*14/1e6 = 0.014 + 0.014 = 0.028
  near(a, 0.028);
});

test('prefix hit saves prefix × input × (1 - cacheRead)', () => {
  // Opus 5 input $5/MTok, cacheRead 0.1 → 90% off the 20k shared prefix.
  // 20000 * 5/1e6 * 0.9 = 0.10 * 0.9 = 0.09
  const saved = dollarsSaved({ layer: 'prefix', model: 'claude-opus-5', prefixTokens: 20000 });
  near(saved, 0.09);
});

test('unknown model: full-call hit returns 0 (never overstate)', () => {
  assert.equal(dollarsSaved({ layer: 'exact', model: 'mystery-9', inputTokens: 10000, outputTokens: 5000 }), 0);
});

test('setPrices overrides are honored', () => {
  setPrices({ 'mystery-9': { in: 3, out: 6, cacheRead: 0.2 } });
  const saved = dollarsSaved({ layer: 'exact', model: 'mystery-9', inputTokens: 1_000_000, outputTokens: 0 });
  near(saved, 3); // 1M input tokens * $3/MTok
  setPrices(DEFAULT_PRICES); // reset
});

test('summarize nets gross savings against the plan cost and reports ROI', () => {
  const events = [
    { layer: 'prefix', model: 'claude-opus-5', prefixTokens: 20000 },  // 0.09
    { layer: 'exact',  model: 'claude-opus-5', inputTokens: 10000, outputTokens: 2000 }, // 0.10
    { layer: 'semantic', model: 'gpt-5.2', inputTokens: 8000, outputTokens: 1000 }, // 0.028
  ];
  const s = summarize(events, { planCostUsd: 0.1 });
  near(s.grossSavedUsd, round2(0.09 + 0.10 + 0.028)); // 0.22
  assert.equal(s.hits, 3);
  assert.equal(s.netSavedUsd, round2(0.22 - 0.1)); // 0.12
  assert.equal(s.roi, round2(0.22 / 0.1)); // 2.2
  assert.equal(s.byLayer.prefix, 0.09);
});

test('scaled realistic month clears a Pro plan many times over', () => {
  // 50k prefix hits/mo at 18k-token prefixes on Opus 5.
  const events = Array.from({ length: 50000 }, () => ({ layer: 'prefix', model: 'claude-opus-5', prefixTokens: 18000 }));
  const s = summarize(events, { planCostUsd: 99 });
  // per hit: 18000 * 5/1e6 * 0.9 = 0.081 → * 50000 = 4050
  near(s.grossSavedUsd, 4050);
  assert.ok(s.netSavedUsd > 3900);
  assert.ok(s.roi > 40); // >$40 saved per $1 of plan
});

console.log('\n' + passed + ' passed');
