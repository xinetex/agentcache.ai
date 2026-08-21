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
  ['Core · engine (pkg)', 'packages/agentcache-engine/test/engine.test.mjs'],
  ['Knowledge · ingest gate', 'tests/ingest-guard.test.mjs'],
  ['Guardrails · firewall', 'tests/firewall.test.mjs'],
  ['Guardrails · swarm breaker', 'tests/swarm-breaker.test.mjs'],
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
