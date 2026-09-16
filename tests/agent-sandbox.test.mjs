// tests/agent-sandbox.test.mjs
//   node tests/agent-sandbox.test.mjs

import assert from 'node:assert/strict';
import {
  executeTool,
  BUILTIN_TOOLS,
  SANDBOX_DEFAULTS,
} from '../lib/agent-sandbox.js';

let passed = 0;
const test = async (n, f) => { await f(); passed++; console.log('  ✓ ' + n); };

console.log('agent-sandbox');

(async () => {
  await test('executeTool runs echo builtin tool', async () => {
    const res = await executeTool({ tool: 'echo', args: { message: 'hello agent' } });
    assert.equal(res.success, true);
    assert.equal(res.tool, 'echo');
    assert.equal(res.output, 'hello agent');
    assert.ok(typeof res.durationMs === 'number');
  });

  await test('executeTool runs calculator tool for safe expressions', async () => {
    const res = await executeTool({ tool: 'calculator', args: { expr: '10 * 5 + (20 / 4)' } });
    assert.equal(res.success, true);
    assert.equal(res.output.result, 55);
  });

  await test('executeTool rejects unsafe expressions in calculator', async () => {
    const res = await executeTool({ tool: 'calculator', args: { expr: 'process.exit(1)' } });
    assert.equal(res.success, false);
    assert.ok(res.error.includes('Unsafe expression'));
  });

  await test('executeTool runs json_transform tool', async () => {
    const res = await executeTool({ tool: 'json_transform', args: { data: { temperature: 72, humidity: 45 }, key: 'temperature' } });
    assert.equal(res.success, true);
    assert.equal(res.output, 72);
  });

  await test('executeTool fails cleanly on unregistered tool', async () => {
    const res = await executeTool({ tool: 'non_existent_tool', args: {} });
    assert.equal(res.success, false);
    assert.ok(res.error.includes('not registered'));
  });

  await test('executeTool supports custom tool registration', async () => {
    const customRegistry = {
      reverse_text: async (args) => (args.text || '').split('').reverse().join(''),
    };
    const res = await executeTool({ tool: 'reverse_text', args: { text: 'agentcache' } }, customRegistry);
    assert.equal(res.success, true);
    assert.equal(res.output, 'ehcactnega');
  });

  await test('executeTool enforces execution timeout', async () => {
    const customRegistry = {
      slow_tool: async () => new Promise((resolve) => setTimeout(() => resolve('done'), 100)),
    };
    const res = await executeTool({ tool: 'slow_tool', timeoutMs: 20 }, customRegistry);
    assert.equal(res.success, false);
    assert.ok(res.error.includes('timed out'));
  });

  await test('executeTool bounds large tool outputs', async () => {
    const customRegistry = {
      huge_output: async () => 'DATA_'.repeat(1000),
    };
    const res = await executeTool({ tool: 'huge_output', maxOutputChars: 200 }, customRegistry);
    assert.equal(res.success, true);
    assert.ok(res.output.includes('Truncated'));
    assert.ok(res.output.length < 1000);
  });

  console.log('\n' + passed + ' passed');
})();
