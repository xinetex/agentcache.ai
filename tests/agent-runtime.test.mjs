// tests/agent-runtime.test.mjs
//   node tests/agent-runtime.test.mjs
//
// The governed durable-run state machine. Must be deterministic (replay-safe),
// pause for humans exactly when policy says, hard-block runaways, and carry
// reasoning + savings across steps.

import assert from 'node:assert/strict';
import {
  RUN, estimateCostUsd, planStep, initRun, reduceRun, checkpoint, restore, isTerminal,
} from '../lib/agent-runtime.js';

let passed = 0;
const test = (n, f) => { f(); passed++; console.log('  ✓ ' + n); };
const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} !~= ${b}`);

console.log('agent-runtime');

test('estimateCostUsd prices a known model, 0 for unknown', () => {
  const a = estimateCostUsd({ model: 'claude-opus-5', inputTokens: 40000, outputTokens: 8000 });
  near(a.estCostUsd, 40000 * 5 / 1e6 + 8000 * 25 / 1e6); // 0.2 + 0.2 = 0.4
  assert.equal(a.priced, true);
  assert.equal(estimateCostUsd({ model: 'mystery-9', inputTokens: 1e6 }).priced, false);
});

test('planStep proceeds under an ample budget', () => {
  const p = planStep({ policy: { budgetUsd: 1000 }, run: { spentUsd: 1 }, proposedCall: { model: 'claude-opus-5', inputTokens: 1000, outputTokens: 100 } });
  assert.equal(p.action, 'proceed');
});

test('planStep pauses for a human in the warn band', () => {
  const p = planStep({ policy: { budgetUsd: 100, warnRatio: 0.8 }, run: { spentUsd: 85 }, proposedCall: { model: 'claude-opus-5', inputTokens: 1000, outputTokens: 100 } });
  assert.equal(p.action, 'pause');
});

test('planStep pauses when a single call exceeds the approval threshold', () => {
  const p = planStep({ policy: { budgetUsd: 1e6 }, run: { spentUsd: 0 }, proposedCall: { model: 'claude-opus-5', inputTokens: 400000, outputTokens: 80000 }, approvalThresholdUsd: 1 });
  assert.equal(p.action, 'pause'); // ~ $4 call > $1 threshold
});

test('planStep pauses when the call is explicitly flagged requiresApproval', () => {
  const p = planStep({ policy: {}, run: {}, proposedCall: { model: 'claude-opus-5', inputTokens: 10, requiresApproval: true } });
  assert.equal(p.action, 'pause');
});

test('planStep blocks a call that would cross the budget ceiling', () => {
  const p = planStep({ policy: { budgetUsd: 100 }, run: { spentUsd: 99 }, proposedCall: { model: 'claude-opus-5', inputTokens: 400000, outputTokens: 80000 } });
  assert.equal(p.action, 'block');
});

test('planStep blocks under an engaged kill-switch', () => {
  const p = planStep({ policy: { killSwitch: true, budgetUsd: 1e9 }, run: {}, proposedCall: { model: 'claude-opus-5' } });
  assert.equal(p.action, 'block');
});

test('reduceRun: PLAN(proceed) keeps RUNNING and stores pending', () => {
  const s0 = initRun({ runId: 'r1' });
  const plan = planStep({ policy: { budgetUsd: 1000 }, run: s0, proposedCall: { model: 'claude-opus-5', inputTokens: 1000 } });
  const s1 = reduceRun(s0, { type: 'PLAN', plan, proposedCall: { model: 'claude-opus-5', inputTokens: 1000 } });
  assert.equal(s1.status, RUN.RUNNING);
  assert.ok(s1.pending);
});

test('reduceRun: PLAN(pause) → PAUSED, RESUME approve → RUNNING, reject → KILLED', () => {
  let s = initRun({ runId: 'r2' });
  s = reduceRun(s, { type: 'PLAN', plan: { action: 'pause', estCostUsd: 4 }, proposedCall: { model: 'x' } });
  assert.equal(s.status, RUN.PAUSED);
  const approved = reduceRun(s, { type: 'RESUME', decision: 'approve' });
  assert.equal(approved.status, RUN.RUNNING);
  const rejected = reduceRun(s, { type: 'RESUME', decision: 'reject' });
  assert.equal(rejected.status, RUN.KILLED);
});

test('reduceRun: EXECUTE accumulates spend, savings, reasoning, and advances step', () => {
  let s = initRun({ runId: 'r3' });
  s = reduceRun(s, { type: 'PLAN', plan: { action: 'proceed', estCostUsd: 0.4 }, proposedCall: { model: 'claude-opus-5' } });
  s = reduceRun(s, {
    type: 'EXECUTE',
    result: { model: 'claude-opus-5', layer: 'prefix', prefixTokens: 20000, costUsd: 0.4 },
    reasoningDelta: { facts: ['api is rate-limited at 100rps'], decisions: ['batch requests'] },
  }, '2026-08-24');
  assert.equal(s.step, 1);
  assert.equal(s.stepsExecuted, 1);
  near(s.spentUsd, 0.4);
  near(s.savedUsd, 0.09); // 20k prefix on opus-5
  assert.equal(s.ledger.length, 1);
  assert.deepEqual(s.reasoning.facts, ['api is rate-limited at 100rps']);
  assert.equal(s.pending, null);
});

test('reduceRun is a REPLAY-SAFE reducer (same events → same durable state)', () => {
  const events = [
    { type: 'PLAN', plan: { action: 'proceed', estCostUsd: 0.1 }, proposedCall: { model: 'claude-opus-5' } },
    { type: 'EXECUTE', result: { model: 'claude-opus-5', costUsd: 0.1 } },
    { type: 'PLAN', plan: { action: 'proceed', estCostUsd: 0.2 }, proposedCall: { model: 'claude-opus-5' } },
    { type: 'EXECUTE', result: { model: 'claude-opus-5', costUsd: 0.2 } },
    { type: 'COMPLETE' },
  ];
  const run = () => events.reduce((s, e) => reduceRun(s, e, 'now'), initRun({ runId: 'rp' }));
  const a = checkpoint(run());
  const b = checkpoint(run());
  assert.deepEqual(a, b);
  assert.equal(a.status, RUN.COMPLETED);
  near(a.spentUsd, 0.3);
});

test('checkpoint/restore round-trips durable state (drops replayable history)', () => {
  let s = initRun({ runId: 'r4' });
  s = reduceRun(s, { type: 'PLAN', plan: { action: 'proceed', estCostUsd: 0.1 }, proposedCall: { model: 'claude-opus-5' } });
  const chk = checkpoint(s);
  assert.ok(!('history' in chk));
  const restored = restore(chk);
  assert.equal(restored.runId, 'r4');
  assert.deepEqual(restored.history, []);
});

test('terminal states are terminal and ignore further events', () => {
  let s = initRun({ runId: 'r5' });
  s = reduceRun(s, { type: 'KILL', reason: 'ops' });
  assert.equal(s.status, RUN.KILLED);
  assert.ok(isTerminal(s));
  const s2 = reduceRun(s, { type: 'EXECUTE', result: { costUsd: 5 } });
  assert.equal(s2.spentUsd, 0); // no spend after kill
});

console.log('\n' + passed + ' passed');
