// examples/agent-loop-demo.mjs
//
// Simulates a fleet of coding agents running through AgentCache and prints the
// live savings ledger. Nothing here is mocked in the engine — only the LLM
// itself is faked (and instrumented to prove how many real calls were saved).
//
//   node examples/agent-loop-demo.mjs

import { AgentCache, MemoryStore } from '../src/index.js';

// ---- a fake provider that reports realistic token usage & counts real calls ----
let realCalls = 0;
let realCostUsd = 0;
const PRICE = { in: 5, out: 25 }; // Claude Opus 5 $/MTok
async function fakeOpus(req) {
  realCalls++;
  const inTok = req.messages.reduce((s, m) => s + Math.ceil((m.content?.length || 0) / 4), 0);
  const outTok = 600;
  realCostUsd += inTok * PRICE.in / 1e6 + outTok * PRICE.out / 1e6;
  return { content: 'result::' + Math.random().toString(36).slice(2, 8), usage: { inputTokens: inTok, outputTokens: outTok } };
}

// A big, stable system prompt + tool defs — the reused prefix (~20k tokens).
const SYSTEM = { role: 'system', content: 'You are a coding agent.\n' + 'CONTEXT '.repeat(9000) };
const TOOLS = { role: 'system', content: 'TOOLS: read_file, write_file, run_tests, open_pr' };

const ac = new AgentCache({
  store: new MemoryStore(),
  org: 'acme',
  namespace: 'ci-agents',
  planCostUsd: 99, // Pro plan
});

const model = 'claude-opus-5';
const tasks = ['fix flaky auth test', 'add rate limiter', 'refactor cache keys', 'patch CORS', 'write migration'];
let totalRequests = 0;

// One month at Pro scale: 3,000 agent runs, each a multi-step loop over a
// shared prefix; tasks recur across runs (exact hits), every run reuses prefix.
for (let run = 0; run < 3000; run++) {
  const task = tasks[run % tasks.length]; // tasks repeat → exact hits appear
  const sessionId = 'run-' + run;
  const steps = 4 + (run % 3);
  for (let step = 0; step < steps; step++) {
    const messages = [SYSTEM, TOOLS, { role: 'user', content: 'TASK: ' + task }];
    for (let k = 0; k < step; k++) {
      messages.push({ role: 'assistant', content: 'step ' + k + ' output' });
      messages.push({ role: 'user', content: 'continue' });
    }
    await ac.complete({ model, messages, sessionId }, fakeOpus);
    totalRequests++;
  }
}

const s = ac.savings();
const withoutCache = realCostUsd + s.grossSavedUsd; // what they'd have paid with no cache
const fmt = (n) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

console.log('\n  AgentCache — live agent-loop demo');
console.log('  ' + '-'.repeat(52));
console.log('  Agent requests processed : ' + s.requests);
console.log('  Real LLM calls made      : ' + realCalls + '  (exact hits skipped ' + (s.requests - realCalls) + ' calls)');
console.log('  Effective hit rate       : ' + Math.round(s.hitRate * 100) + '%');
console.log('  ' + '-'.repeat(52));
console.log('  Spend WITHOUT AgentCache : ' + fmt(withoutCache));
console.log('  Actual model spend       : ' + fmt(realCostUsd));
console.log('  Gross saved              : ' + fmt(s.grossSavedUsd));
console.log('    · prefix layer         : ' + fmt(s.byLayer.prefix || 0));
console.log('    · exact layer          : ' + fmt(s.byLayer.exact || 0));
console.log('  Plan cost                : ' + fmt(s.planCostUsd));
console.log('  NET SAVED                : ' + fmt(s.netSavedUsd));
console.log('  ROI on plan              : ' + s.roi + '×');
console.log('  ' + '-'.repeat(52) + '\n');
