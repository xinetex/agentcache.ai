// scripts/agentcache-test.mjs
//
// One command to prove the whole AgentCache core is green together.
//   node scripts/agentcache-test.mjs
//
// Runs every test suite added in the core consolidation. Add a line here when
// you add a suite — this is the single source of truth for "is the core OK".

import { spawnSync } from 'node:child_process';

const SUITES = [
  ['Core · prefix cache', 'tests/prefix-cache.test.mjs'],
  ['Core · savings math', 'tests/savings.test.mjs'],
  ['Core · savings recorder', 'tests/savings-recorder.test.mjs'],
  ['Control · governance', 'tests/governance.test.mjs'],
  ['Moat · reasoning cache', 'tests/reasoning-cache.test.mjs'],
  ['Platform · agent runtime', 'tests/agent-runtime.test.mjs'],
  ['Platform · agent harness (SDK)', 'tests/agent-harness.test.mjs'],
  ['Platform · context compactor', 'tests/context-compactor.test.mjs'],
  ['Platform · agent sandbox', 'tests/agent-sandbox.test.mjs'],
  ['Platform · hitl notifier', 'tests/hitl-notifier.test.mjs'],
  ['Security · run authz', 'tests/run-authz.test.mjs'],
  ['Platform · run store', 'tests/run-store.test.mjs'],
  ['Adoption · key fallback', 'tests/api-key-fallback.test.mjs'],
  ['Platform · self-provision schema', 'tests/ensure-schema.test.mjs'],
  ['Core · engine (pkg)', 'packages/agentcache-engine/test/engine.test.mjs'],
  ['Knowledge · ingest gate', 'tests/ingest-guard.test.mjs'],
  ['Guardrails · firewall', 'tests/firewall.test.mjs'],
  ['Guardrails · swarm breaker', 'tests/swarm-breaker.test.mjs'],
  ['Governance · linguistic guard', 'tests/linguistic-guard.test.mjs'],
  ['Governance · rosetta bridge', 'tests/rosetta-bridge.test.mjs'],
  ['Governance · grounded verifier', 'tests/grounded-verifier.test.mjs'],
  ['Platform · replay engine', 'tests/replay-engine.test.mjs'],
  ['Security · audit vault', 'tests/audit-vault.test.mjs'],
  ['Governance · contagion tracker', 'tests/contagion-tracker.test.mjs'],
  ['Platform · human hotswap', 'tests/human-hotswap.test.mjs'],
  ['Security · identity verifier', 'tests/identity-verifier.test.mjs'],
  ['Simulation · Glossogen swarm scenario', 'scripts/simulate-glossogen-swarm.mjs'],
];

let failed = 0;
let total = 0;
console.log('\n  AgentCache core — unified suite\n  ' + '='.repeat(50));
for (const [label, file] of SUITES) {
  const r = spawnSync('node', [file], { encoding: 'utf8' });
  const lastLine = (r.stdout || '').trim().split('\n').pop() || '';
  const m = lastLine.match(/(\d+)\s+passed/);
  const count = m ? Number(m[1]) : 0;
  total += count;
  const ok = r.status === 0;
  if (!ok) { failed++; }
  console.log(`  ${ok ? '✅ PASS' : '❌ FAIL'}  ${label.padEnd(30)} ${count ? count + ' tests' : ''}`);
  if (!ok) process.stderr.write((r.stderr || '') + (r.stdout || ''));
}
console.log('  ' + '='.repeat(50));
console.log(`  ${failed ? '❌ ' + failed + ' suite(s) failed' : '✅ all ' + SUITES.length + ' suites passed'} · ${total} tests total\n`);
process.exit(failed ? 1 : 0);
