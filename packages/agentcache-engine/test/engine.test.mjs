// test/engine.test.mjs — end-to-end engine behavior. Zero deps.
//   node test/engine.test.mjs

import assert from 'node:assert/strict';
import { AgentCache, MemoryStore } from '../src/index.js';

let passed = 0;
const test = (name, fn) => async () => { await fn(); passed++; console.log('  ✓ ' + name); };
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~= ${b}`);

const sys = { role: 'system', content: 'X'.repeat(80000) };   // ~20k-token stable prefix
const tools = { role: 'system', content: 'TOOLS: read, write, run' };

// A fake LLM that counts how many times it was actually called.
function fakeLLM() {
  const state = { calls: 0 };
  const fn = async (req) => {
    state.calls++;
    return { content: 'answer-' + state.calls, usage: { inputTokens: 20200, outputTokens: 500 } };
  };
  return { fn, state };
}

console.log('engine');

const run = async () => {
  await test('identical request is served from exact cache; LLM called once', async () => {
    const { fn, state } = fakeLLM();
    const ac = new AgentCache({ store: new MemoryStore(), org: 'acme', model: 'claude-opus-5' });
    const req = { model: 'claude-opus-5', messages: [sys, tools, { role: 'user', content: 'hi' }], sessionId: 's1' };
    const a = await ac.complete(req, fn);
    const b = await ac.complete(req, fn);
    assert.equal(a.cached, false);
    assert.equal(b.cached, true);
    assert.equal(b.layer, 'exact');
    assert.equal(state.calls, 1, 'LLM must only be called once');
    assert.ok(b.savedUsd > 0);
  })();

  await test('exact-hit dollar value uses stored token counts', async () => {
    const { fn } = fakeLLM();
    const ac = new AgentCache({ store: new MemoryStore(), org: 'acme' });
    const req = { model: 'claude-opus-5', messages: [{ role: 'user', content: 'q' }], sessionId: 's' };
    await ac.complete(req, fn);
    const hit = await ac.complete(req, fn);
    // Opus 5: 20200*5/1e6 + 500*25/1e6 = 0.101 + 0.0125 = 0.1135
    near(hit.savedUsd, 0.1135);
  })();

  await test('appended turn reuses the warm prefix and records prefix savings', async () => {
    const { fn, state } = fakeLLM();
    const ac = new AgentCache({ store: new MemoryStore(), org: 'acme' });
    const turn1 = { model: 'claude-opus-5', messages: [sys, tools, { role: 'user', content: 'step 1' }], sessionId: 'run' };
    const turn2 = { model: 'claude-opus-5', messages: [sys, tools, { role: 'user', content: 'step 1' },
      { role: 'assistant', content: 'ok' }, { role: 'user', content: 'step 2' }], sessionId: 'run' };
    await ac.complete(turn1, fn); // miss, seeds prefix
    const r2 = await ac.complete(turn2, fn); // new content → real call, but prefix reused
    assert.equal(r2.cached, false);
    assert.equal(r2.layer, 'prefix');
    assert.equal(r2.reusableMessages, 3);       // sys, tools, "step 1"
    assert.equal(r2.breakpointIndex, 2);
    assert.ok(r2.savedUsd > 0);
    assert.equal(state.calls, 2);
  })();

  await test('tenant isolation: another org does not see the cache', async () => {
    const store = new MemoryStore();
    const a = new AgentCache({ store, org: 'orgA' });
    const b = new AgentCache({ store, org: 'orgB' });
    const req = { model: 'claude-opus-5', messages: [{ role: 'user', content: 'secret' }] };
    const { fn: fa, state: sa } = fakeLLM();
    const { fn: fb, state: sb } = fakeLLM();
    await a.complete(req, fa);
    const bResp = await b.complete(req, fb); // different org prefix → miss
    assert.equal(bResp.cached, false);
    assert.equal(sb.calls, 1, 'orgB must hit its own LLM, not orgA cache');
  })();

  await test('invalidateSession clears the warm prefix', async () => {
    const { fn } = fakeLLM();
    const ac = new AgentCache({ store: new MemoryStore(), org: 'acme' });
    const t = { model: 'claude-opus-5', messages: [sys, tools, { role: 'user', content: 'a' }], sessionId: 'x' };
    await ac.complete(t, fn);
    await ac.invalidateSession('x');
    const t2 = { model: 'claude-opus-5', messages: [sys, tools, { role: 'user', content: 'a2' }], sessionId: 'x' };
    const r = await ac.complete(t2, fn);
    assert.equal(r.layer, 'miss', 'prefix was invalidated, so no reuse');
  })();

  await test('savings() reports net + ROI against the plan', async () => {
    const { fn } = fakeLLM();
    const ac = new AgentCache({ store: new MemoryStore(), org: 'acme', planCostUsd: 0.05 });
    const req = { model: 'claude-opus-5', messages: [{ role: 'user', content: 'z' }] };
    await ac.complete(req, fn);       // miss (no savings)
    await ac.complete(req, fn);       // exact hit (+0.1135)
    const s = ac.savings();
    assert.equal(s.requests, 2);
    assert.equal(s.hits, 1);
    near(s.grossSavedUsd, 0.11);      // rounded
    assert.equal(s.netSavedUsd, +(0.11 - 0.05).toFixed(2));
    assert.ok(s.roi > 1);
  })();

  console.log('\n' + passed + ' passed');
};

run().catch((e) => { console.error(e); process.exit(1); });
