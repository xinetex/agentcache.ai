// tests/governance.test.mjs
//   node tests/governance.test.mjs
//
// The control plane's decisions must be deterministic and defensible. These
// pin every branch of the gate: kill-switch, budget ceiling + warn band,
// request quota, spend-anomaly (advisory vs blocking), and the fail-safe
// "allow when unconfigured" rule.

import assert from 'node:assert/strict';
import {
  SEVERITY, evaluateSpend, checkQuota, detectAnomaly, decide,
} from '../lib/governance.js';

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('  ✓ ' + name); };

console.log('governance');

// --- evaluateSpend ---
test('spend under warn band is ok', () => {
  const r = evaluateSpend({ spentUsd: 10, budgetUsd: 100 });
  assert.equal(r.state, SEVERITY.OK);
  assert.equal(r.remainingUsd, 90);
});
test('spend in warn band (>=80%) warns', () => {
  assert.equal(evaluateSpend({ spentUsd: 85, budgetUsd: 100 }).state, SEVERITY.WARN);
});
test('projected spend over ceiling blocks (uses estCostUsd)', () => {
  assert.equal(evaluateSpend({ spentUsd: 95, budgetUsd: 100, estCostUsd: 10 }).state, SEVERITY.BLOCK);
});
test('no budget set = ungoverned ok, budgetSet:false', () => {
  const r = evaluateSpend({ spentUsd: 999 });
  assert.equal(r.state, SEVERITY.OK);
  assert.equal(r.budgetSet, false);
  assert.equal(r.remainingUsd, Infinity);
});

// --- checkQuota ---
test('quota at limit blocks; under warns/oks correctly', () => {
  assert.equal(checkQuota({ used: 100, limit: 100 }).state, SEVERITY.BLOCK);
  assert.equal(checkQuota({ used: 90, limit: 100 }).state, SEVERITY.WARN);
  assert.equal(checkQuota({ used: 10, limit: 100 }).state, SEVERITY.OK);
  assert.equal(checkQuota({ used: 10, limit: 100 }).remaining, 90);
});
test('no quota set is unlimited', () => {
  const r = checkQuota({ used: 1e9 });
  assert.equal(r.state, SEVERITY.OK);
  assert.equal(r.limitSet, false);
});

// --- detectAnomaly ---
test('insufficient history never flags', () => {
  assert.equal(detectAnomaly([1, 2, 3]).anomaly, false);
});
test('a clear overnight spike is flagged', () => {
  // 13 quiet days ~$5, then a $400 night.
  const series = [5, 6, 4, 5, 5, 6, 5, 4, 5, 6, 5, 5, 5, 400];
  const r = detectAnomaly(series, { sigma: 3 });
  assert.equal(r.anomaly, true);
  assert.ok(r.z > 3);
});
test('steady spend is not an anomaly', () => {
  const series = [100, 102, 98, 101, 99, 100, 103, 101];
  assert.equal(detectAnomaly(series).anomaly, false);
});
test('flat history: a jump flags, identical does not', () => {
  assert.equal(detectAnomaly([10, 10, 10, 10, 10, 10, 10, 11]).anomaly, true);
  assert.equal(detectAnomaly([10, 10, 10, 10, 10, 10, 10, 10]).anomaly, false);
});

// --- decide (the gate) ---
test('kill-switch denies unconditionally', () => {
  const d = decide({ killSwitch: true, budgetUsd: 1e9 }, { spentUsd: 0 });
  assert.equal(d.allow, false);
  assert.equal(d.severity, SEVERITY.BLOCK);
  assert.ok(d.reasons[0].includes('kill-switch'));
});
test('budget ceiling denies the call that would cross it', () => {
  const d = decide({ budgetUsd: 100 }, { spentUsd: 99, estCostUsd: 5 });
  assert.equal(d.allow, false);
  assert.equal(d.severity, SEVERITY.BLOCK);
});
test('warn band allows but surfaces severity=warn', () => {
  const d = decide({ budgetUsd: 100 }, { spentUsd: 85, estCostUsd: 1 });
  assert.equal(d.allow, true);
  assert.equal(d.severity, SEVERITY.WARN);
  assert.ok(d.reasons.some((r) => r.includes('budget')));
});
test('anomaly is advisory by default, blocking when blockOnAnomaly', () => {
  const spike = [5, 5, 5, 5, 5, 5, 5, 500];
  const advisory = decide({ budgetUsd: 1e6, anomalySigma: 3 }, { spentUsd: 1, series: spike });
  assert.equal(advisory.allow, true);
  assert.equal(advisory.severity, SEVERITY.WARN);
  const blocking = decide({ budgetUsd: 1e6, anomalySigma: 3, blockOnAnomaly: true }, { spentUsd: 1, series: spike });
  assert.equal(blocking.allow, false);
});
test('fully unconfigured policy fails safe = allow', () => {
  const d = decide({}, { spentUsd: 12345, usedRequests: 999 });
  assert.equal(d.allow, true);
  assert.equal(d.severity, SEVERITY.OK);
});
test('quota exhaustion denies even when budget is fine', () => {
  const d = decide({ budgetUsd: 1e6, quotaRequests: 1000 }, { spentUsd: 1, usedRequests: 1000 });
  assert.equal(d.allow, false);
  assert.ok(d.reasons.some((r) => r.includes('quota')));
});

console.log('\n' + passed + ' passed');
