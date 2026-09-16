// tests/context-compactor.test.mjs
//   node tests/context-compactor.test.mjs

import assert from 'node:assert/strict';
import {
  COMPACT_DEFAULTS,
  estimateTokens,
  truncateObservation,
  summarizeToolResults,
  compactHistory,
} from '../lib/context-compactor.js';

let passed = 0;
const test = (n, f) => { f(); passed++; console.log('  ✓ ' + n); };

console.log('context-compactor');

test('estimateTokens estimates token count based on character length', () => {
  assert.equal(estimateTokens(''), 0);
  assert.equal(estimateTokens('hello world'), 3); // 11 chars / 4 -> 3
  assert.equal(estimateTokens({ a: 1 }), 2); // '{"a":1}' (7 chars) / 4 -> 2
});

test('truncateObservation keeps short outputs intact', () => {
  const shortText = 'Short output from tool';
  assert.equal(truncateObservation(shortText, 100), shortText);
});

test('truncateObservation truncates large strings with informative header/footer', () => {
  const largeText = 'A'.repeat(5000);
  const truncated = truncateObservation(largeText, 1000);
  assert.ok(truncated.length < 5000);
  assert.ok(truncated.includes('Truncated'));
  assert.ok(truncated.includes('AgentCache ContextCompactor'));
});

test('summarizeToolResults structures tool outputs and truncates long contents', () => {
  const rawResults = [
    { tool: 'weather', output: '72F Sunny' },
    { tool: 'big_query', output: 'X'.repeat(2000), success: true },
    { tool: 'failing_api', error: 'Network timeout' },
  ];
  const summary = summarizeToolResults(rawResults);
  assert.equal(summary.length, 3);
  assert.equal(summary[0].tool, 'weather');
  assert.equal(summary[0].status, 'ok');
  assert.equal(summary[0].summary, '72F Sunny');
  assert.equal(summary[1].status, 'ok');
  assert.ok(summary[1].summary.includes('Truncated'));
  assert.equal(summary[2].status, 'failed');
  assert.equal(summary[2].summary, 'Network timeout');
});

test('compactHistory passes small message history through unchanged', () => {
  const messages = [
    { role: 'system', content: 'You are an agent.' },
    { role: 'user', content: 'Run task' },
    { role: 'assistant', content: 'Step 1' },
  ];
  const res = compactHistory(messages, { maxTokens: 1000, keepRecentTurns: 2 });
  assert.equal(res.compacted, false);
  assert.equal(res.messages.length, 3);
});

test('compactHistory consolidates middle turns when token budget is exceeded', () => {
  const longTurn = 'Detailed intermediate tool log: ' + 'step-data-'.repeat(200);
  const messages = [
    { role: 'system', content: 'Initial Task Goal' },
    { role: 'user', content: longTurn },
    { role: 'assistant', content: longTurn },
    { role: 'user', content: longTurn },
    { role: 'assistant', content: longTurn },
    { role: 'user', content: 'Recent question' },
    { role: 'assistant', content: 'Recent answer' },
  ];
  const res = compactHistory(messages, { maxTokens: 100, keepRecentTurns: 2 });
  assert.equal(res.compacted, true);
  assert.equal(res.distilledTurns, 4);
  assert.ok(res.tokensSavedEstimate > 0);
  assert.equal(res.messages[0].content, 'Initial Task Goal');
  assert.ok(res.messages[1].content.includes('Context Distillation'));
  assert.equal(res.messages[res.messages.length - 1].content, 'Recent answer');
});

console.log('\n' + passed + ' passed');
