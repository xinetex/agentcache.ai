// tests/agent-harness.test.mjs
//   node tests/agent-harness.test.mjs

import assert from 'node:assert/strict';
import { AgentHarness, createAgentHarness } from '../lib/agent-harness.js';
import { RUN } from '../lib/agent-runtime.js';

let passed = 0;
const test = async (n, f) => { await f(); passed++; console.log('  ✓ ' + n); };

console.log('agent-harness');

(async () => {
  await test('AgentHarness runs full task lifecycle with tool sandbox and spend recording', async () => {
    const harness = createAgentHarness({
      agentId: 'code_reviewer',
      maxBudgetUsd: 10,
    });

    const run = harness.startRun('Review PR #42');
    assert.equal(run.state.status, RUN.RUNNING);

    // 1. Plan step
    const planResult = await harness.plan(run, {
      model: 'claude-opus-5',
      inputTokens: 1000,
      outputTokens: 200,
    });
    assert.equal(planResult.action, 'proceed');

    // 2. Execute safe tool in sandbox
    const toolResult = await harness.executeTool(run, 'echo', { message: 'Analyzing diff...' });
    assert.equal(toolResult.success, true);
    assert.equal(toolResult.output, 'Analyzing diff...');

    // 3. Record model execution & cache hit
    harness.recordStep(run, {
      model: 'claude-opus-5',
      layer: 'exact',
      inputTokens: 1000,
      outputTokens: 200,
      costUsd: 0.01,
    }, {
      facts: ['PR modifies auth middleware'],
    });

    // 4. Complete run
    const summary = harness.completeRun(run);
    assert.equal(summary.status, RUN.COMPLETED);
    assert.equal(summary.stepsExecuted, 1);
    assert.ok(summary.savedUsd > 0);
    assert.deepEqual(summary.factsLearned, ['PR modifies auth middleware']);
  });

  await test('AgentHarness detects cyclic tool loop and blocks runaway execution', async () => {
    const harness = createAgentHarness({
      agentId: 'looping_agent',
    });

    const run = harness.startRun('Debug failing test');

    // Simulate 3 identical failing tool calls
    await harness.executeTool(run, 'calculator', { expr: '1+1' });
    await harness.executeTool(run, 'calculator', { expr: '1+1' });
    await harness.executeTool(run, 'calculator', { expr: '1+1' });

    // Next plan should detect cyclic repetition and BLOCK
    const planResult = await harness.plan(run, { model: 'claude-opus-5' });
    assert.equal(planResult.action, RUN.BLOCKED);
    assert.ok(planResult.plan.reasons[0].includes('Cyclic loop'));
  });

  await test('AgentHarness pauses and invokes onApprovalRequired on high-cost calls', async () => {
    let approvalTriggered = false;

    const harness = createAgentHarness({
      agentId: 'cautious_agent',
      approvalThresholdUsd: 1.00, // > $1 requires approval
      onApprovalRequired: async (card) => {
        approvalTriggered = true;
        assert.ok(card.approveUrl);
        return 'approve';
      },
    });

    const run = harness.startRun('Large dataset scan');

    // Plan an expensive call (~$4.00)
    const planResult = await harness.plan(run, {
      model: 'claude-opus-5',
      inputTokens: 400000,
      outputTokens: 80000,
    });

    assert.equal(approvalTriggered, true);
    assert.equal(planResult.action, 'proceed'); // resumed because callback approved
  });

  await test('AgentHarness persists reasoning memory across separate runs of the same task', async () => {
    const sharedMemory = new Map();

    const harness = createAgentHarness({
      agentId: 'architect_agent',
      persistReasoning: true,
      memoryStore: sharedMemory,
    });

    // Run 1: Learns architectural facts and commits them
    const run1 = harness.startRun('Refactor auth subsystem');
    harness.commitReasoning(run1, {
      facts: ['Postgres uses Neon serverless', 'Auth key prefix is ac_live_'],
      decisions: ['Use HMAC SHA-256 for key verification'],
    });
    harness.completeRun(run1);

    // Run 2: Starts a new run for the same task - verifies prior facts are loaded
    const run2 = harness.startRun('Refactor auth subsystem');
    assert.equal(run2.state.reasoning.facts.length, 2);
    assert.equal(run2.state.reasoning.facts[0], 'Postgres uses Neon serverless');
    assert.equal(run2.state.reasoning.decisions[0], 'Use HMAC SHA-256 for key verification');
  });

  await test('AgentHarness compactMessages distills long histories to preserve token budget', async () => {
    const harness = createAgentHarness({
      maxHistoryTokens: 100,
    });

    const bulkyTurn = 'Tool output log: ' + 'system-log-entry-'.repeat(50);
    const messages = [
      { role: 'system', content: 'You are an engineer.' },
      { role: 'user', content: bulkyTurn },
      { role: 'assistant', content: bulkyTurn },
      { role: 'user', content: bulkyTurn },
      { role: 'assistant', content: bulkyTurn },
      { role: 'user', content: 'What is the error?' },
    ];

    const res = harness.compactMessages(messages);
    assert.equal(res.compacted, true);
    assert.ok(res.tokensSavedEstimate > 0);
  });

  await test('AgentHarness blocks tool execution on SSRF/template injection and emits GroundedReceipts', async () => {
    const harness = createAgentHarness({ agentId: 'safe_agent' });
    const run = harness.startRun('Test safety gates');

    // 1. Tool execution with SSRF argument is intercepted
    const ssrfResult = await harness.executeTool(run, 'fetch_url', { url: 'http://169.254.169.254/latest' });
    assert.equal(ssrfResult.success, false);
    assert.ok(ssrfResult.error.includes('SSRF attempt'));

    // 2. Safe tool execution succeeds
    const safeResult = await harness.executeTool(run, 'echo', { message: 'Normal payload' });
    assert.equal(safeResult.success, true);

    // 3. Step execution generates a cryptographically signed GroundedReceipt
    const { receipt } = harness.recordStep(run, { costUsd: 0.05 });
    assert.ok(receipt.signature.startsWith('grnd_sha256_'));
    assert.equal(run.state.receipts.length, 1);
  });

  console.log('\n' + passed + ' passed');
})();
