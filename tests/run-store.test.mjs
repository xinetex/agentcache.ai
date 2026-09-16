// tests/run-store.test.mjs
//   node tests/run-store.test.mjs
//
// Proves the two things the run loop previously got wrong: it forgot every run,
// and it gated each run against its own spend instead of the organization's.

import assert from 'node:assert/strict';
import { mergeRunContext, runToRow, persistRun, loadGovernanceContext } from '../lib/run-store.js';
import { planStep } from '../lib/agent-runtime.js';

let passed = 0;
const test = async (n, f) => { await f(); passed++; console.log('  ✓ ' + n); };

console.log('run-store');

(async () => {
  // --- org-wide gating ----------------------------------------------------
  await test('merges org spend and request volume into the run context', async () => {
    const m = mergeRunContext(
      { spentUsd: 12.5, stepsExecuted: 3, series: [] },
      { spentUsd: 400, usedRequests: 900, series: [10, 20, 30] },
    );
    assert.equal(m.spentUsd, 412.5);
    assert.equal(m.stepsExecuted, 903);
    assert.equal(m._runSpentUsd, 12.5); // the run's own spend survives for persistence
  });

  await test("today's series point includes this run's in-flight spend", async () => {
    const m = mergeRunContext({ spentUsd: 25 }, { spentUsd: 100, series: [5, 5, 5] });
    assert.deepEqual(m.series, [5, 5, 30]); // a runaway is visible to anomaly detection NOW
  });

  await test('empty org context degrades to the run itself', async () => {
    const m = mergeRunContext({ spentUsd: 3, stepsExecuted: 1 }, {});
    assert.equal(m.spentUsd, 3);
    assert.equal(m.stepsExecuted, 1);
    assert.deepEqual(m.series, []);
  });

  await test('THE BUG: a $500 budget is not enforceable per-run alone', async () => {
    const policy = { budgetUsd: 500 };
    const org = { spentUsd: 495, usedRequests: 0, series: [] };
    const run = { spentUsd: 0, stepsExecuted: 0, series: [] };
    const call = { model: 'claude-sonnet-5', inputTokens: 1_000_000, outputTokens: 1_000_000 };

    // Before: the run sees only its own $0 spend and sails through.
    const naive = planStep({ policy, run, proposedCall: call });
    assert.equal(naive.action, 'proceed');

    // After: the same call against org-aware context is stopped at the gate.
    const governed = planStep({ policy, run: mergeRunContext(run, org), proposedCall: call });
    assert.equal(governed.action, 'block');
    assert.ok(governed.reasons.join(' ').includes('budget'));
  });

  await test('org quota is enforced across concurrent runs', async () => {
    const policy = { quotaRequests: 1000 };
    const run = { spentUsd: 0, stepsExecuted: 2, series: [] };
    const governed = planStep({ policy, run: mergeRunContext(run, { usedRequests: 999 }), proposedCall: {} });
    assert.equal(governed.action, 'block');
  });

  // --- persistence --------------------------------------------------------
  await test('runToRow maps a terminal run, using the run-local spend', async () => {
    const row = runToRow(
      { runId: 'run_abc12345', status: 'completed', spentUsd: 999, _runSpentUsd: 7.25, savedUsd: 2.5, stepsExecuted: 4, agentId: 'researcher' },
      { organizationId: 'org_a' },
    );
    assert.equal(row.spentUsd, 7.25); // NOT the org-merged 999
    assert.equal(row.terminal, true);
    assert.equal(row.agentId, 'researcher');
  });

  await test('a running run is not terminal', async () => {
    assert.equal(runToRow({ runId: 'r', status: 'running' }, { organizationId: 'o' }).terminal, false);
    assert.equal(runToRow({ runId: 'r', status: 'blocked' }, { organizationId: 'o' }).terminal, true);
    assert.equal(runToRow({ runId: 'r', status: 'killed' }, { organizationId: 'o' }).terminal, true);
  });

  await test('persistRun writes one upsert with the org id bound', async () => {
    const calls = [];
    const sql = async (strings, ...vals) => { calls.push(vals); return []; };
    const r = await persistRun({ sql }, { runId: 'run_abc12345', status: 'running', spentUsd: 1, savedUsd: 0, stepsExecuted: 1 }, { organizationId: 'org_a' });
    assert.equal(calls.length, 1);
    assert.ok(calls[0].includes('run_abc12345'));
    assert.ok(calls[0].includes('org_a'));
    assert.equal(r.status, 'running');
  });

  await test('persistRun refuses to write an unowned row', async () => {
    let called = 0;
    const sql = async () => { called++; return []; };
    assert.equal(await persistRun({ sql }, { runId: 'run_abc12345' }, {}), null); // no org
    assert.equal(await persistRun({ sql }, { status: 'running' }, { organizationId: 'o' }), null); // no runId
    assert.equal(called, 0);
  });

  await test('persistRun FAILS OPEN — telemetry never kills the agent', async () => {
    const sql = async () => { throw new Error('neon unreachable'); };
    const r = await persistRun({ sql }, { runId: 'run_abc12345', status: 'running' }, { organizationId: 'org_a' });
    assert.equal(r, null); // logged, swallowed, run continues
  });

  await test('loadGovernanceContext degrades to a safe zero without sql', async () => {
    const ctx = await loadGovernanceContext(null, 'org_a');
    assert.deepEqual(ctx.org, { spentUsd: 0, usedRequests: 0, series: [] });
    assert.deepEqual(ctx.policy, {});
  });

  console.log(`\n${passed} passed`);
})().catch((e) => { console.error(e); process.exit(1); });
