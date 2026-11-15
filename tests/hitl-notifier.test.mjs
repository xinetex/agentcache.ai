// tests/hitl-notifier.test.mjs
//   node tests/hitl-notifier.test.mjs

import assert from 'node:assert/strict';
import {
  buildApprovalCard,
  dispatchNotification,
} from '../lib/hitl-notifier.js';

let passed = 0;
const test = async (n, f) => { await f(); passed++; console.log('  ✓ ' + n); };

console.log('hitl-notifier');

(async () => {
  await test('buildApprovalCard builds structured approval card with links and Slack blocks', async () => {
    const run = { runId: 'run_abc', agentId: 'deep_researcher', step: 2 };
    const pending = {
      plan: { estCostUsd: 6.50, reasons: ['Single call exceeds approval threshold ($5.00)'] },
      proposedCall: { model: 'claude-opus-5' },
    };

    const card = buildApprovalCard(run, pending, { baseUrl: 'https://agentcache.ai' });
    assert.equal(card.runId, 'run_abc');
    assert.equal(card.agentId, 'deep_researcher');
    assert.equal(card.estCostUsd, 6.50);
    assert.ok(card.approveUrl.includes('runId=run_abc&decision=approve'));
    assert.ok(card.rejectUrl.includes('runId=run_abc&decision=reject'));
    assert.ok(card.text.includes('deep_researcher'));
    assert.ok(Array.isArray(card.slack.blocks));
    assert.equal(card.slack.blocks[0].type, 'header');
  });

  await test('dispatchNotification skips when webhookUrl is omitted', async () => {
    const res = await dispatchNotification(null, { text: 'test' });
    assert.equal(res.ok, false);
    assert.equal(res.skipped, true);
  });

  await test('dispatchNotification posts payload to webhook URL', async () => {
    let calledUrl = '';
    let postedBody = null;
    let postedOptions = null;

    const mockFetch = async (url, opts) => {
      calledUrl = url;
      postedOptions = opts;
      postedBody = JSON.parse(opts.body);
      return { ok: true, status: 200 };
    };

    const card = { text: 'Approve run?', runId: 'run_123' };
    const res = await dispatchNotification('https://hooks.slack.com/services/T123/B456/secret', card, mockFetch);

    assert.equal(res.ok, true);
    assert.equal(res.status, 200);
    assert.equal(calledUrl, 'https://hooks.slack.com/services/T123/B456/secret');
    assert.equal(postedBody.runId, 'run_123');
    assert.equal(postedOptions.redirect, 'error');
  });

  await test('dispatchNotification blocks arbitrary and private-network destinations', async () => {
    let called = false;
    const mockFetch = async () => { called = true; return { ok: true, status: 200 }; };
    const results = await Promise.all([
      dispatchNotification('http://127.0.0.1/admin', { text: 'test' }, mockFetch),
      dispatchNotification('https://attacker.example/hook', { text: 'test' }, mockFetch),
      dispatchNotification('https://hooks.slack.com/services/a/b/c?redirect=https://attacker.example', { text: 'test' }, mockFetch),
    ]);
    assert.ok(results.every((result) => result.skipped));
    assert.equal(called, false);
  });

  console.log('\n' + passed + ' passed');
})();
