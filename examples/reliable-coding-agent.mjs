// examples/reliable-coding-agent.mjs
//
// Demonstrates building a bulletproof autonomous coding agent using AgentCache Harness.
//
// Solves:
//   1. Context bloat & observation bounds
//   2. Cross-run reasoning memory carryover
//   3. Cyclic loop anomaly circuit-breaking
//   4. Verifiable ROI & dollar savings ledger
//
// Run: node examples/reliable-coding-agent.mjs

import { createAgentHarness } from '../lib/agent-harness.js';

console.log('\n🚀 Starting AgentCache Reliable Coding Agent Demo...\n' + '='.repeat(60));

// Shared reasoning store simulating persistent cloud memory
const persistentAgentMemory = new Map();

// 1. Initialize the Harness
const harness = createAgentHarness({
  agentId: 'pi-coding-assistant',
  maxBudgetUsd: 25.00,
  approvalThresholdUsd: 2.00, // Pause if a single call exceeds $2.00
  persistReasoning: true,
  memoryStore: persistentAgentMemory,
  customTools: {
    // Simulated tools
    git_diff: async () => 'diff --git a/src/auth.ts b/src/auth.ts\n+ export function verifyKey() { return true; }',
    read_large_logs: async () => 'TRACE_LOG_DATA_'.repeat(500), // Bulky 7.5KB log
  },
  onApprovalRequired: async (card) => {
    console.log(`\n⚠️  [HITL Paused] Approval requested for Step:\n${card.text}`);
    console.log('✅ Auto-approving step for demonstration purposes...\n');
    return 'approve';
  },
});

// --- SESSION 1: Exploring Repository & Committing Architecture Facts ---
console.log('\n--- 📦 SESSION 1: Initial Exploration & Fact Discovery ---');
const session1 = harness.startRun('Refactor Authentication Layer');

// Step 1: Tool execution with automatic observation bounding
console.log('1. Fetching large build/test logs with sandbox protection...');
const toolResult = await harness.executeTool(session1, 'read_large_logs');
console.log(`   Tool output bounded safely: ${toolResult.output.length} chars (raw was ~7500 chars)`);

// Step 2: Model planning & execution
console.log('2. Running architectural reasoning model call...');
await harness.plan(session1, {
  model: 'claude-opus-5',
  inputTokens: 12000,
  outputTokens: 1500,
});

harness.recordStep(session1, {
  model: 'claude-opus-5',
  layer: 'prefix', // Reused prefix from cache
  inputTokens: 12000,
  prefixTokens: 8000,
  outputTokens: 1500,
  costUsd: 0.10,
});

// Step 3: Commit findings into durable memory
console.log('3. Committing discovered repository facts to durable reasoning cache...');
harness.commitReasoning(session1, {
  facts: [
    'Database connection pool uses Neon Serverless',
    'Auth tokens are hashed using SHA-256 with ac_live_ prefix',
  ],
  decisions: [
    'Migrate legacy bcrypt users to organization tenant keys',
  ],
});

const report1 = harness.completeRun(session1);
console.log(`\n✅ Session 1 Finished: ${report1.status.toUpperCase()}`);
console.log(`   • Net Dollars Saved: $${report1.savedUsd.toFixed(4)}`);
console.log(`   • Facts Discovered: ${report1.factsLearned.join(' | ')}`);

// --- SESSION 2: Resuming Task with Zero-Amnesia ---
console.log('\n--- 🧠 SESSION 2: Resuming Work (Memory Preserved Across Runs) ---');
const session2 = harness.startRun('Refactor Authentication Layer');

console.log(`1. Loaded ${session2.state.reasoning.facts.length} prior facts from reasoning cache without re-reading files!`);
session2.state.reasoning.facts.forEach(f => console.log(`   • Fact: ${f}`));

console.log('2. Executing next implementation step...');
await harness.plan(session2, { model: 'claude-opus-5', inputTokens: 4000, outputTokens: 800 });
harness.recordStep(session2, {
  model: 'claude-opus-5',
  layer: 'exact',
  inputTokens: 4000,
  outputTokens: 800,
  costUsd: 0.05,
});

const report2 = harness.completeRun(session2);
console.log(`✅ Session 2 Finished: ${report2.status.toUpperCase()}`);
console.log(`   • Total Dollars Saved Across Sessions: $${(report1.savedUsd + report2.savedUsd).toFixed(4)}`);

// --- SESSION 3: Demonstrating Cyclic Loop Anomaly Circuit Breaker ---
console.log('\n--- 🛑 SESSION 3: Preventing Infinite Cyclic Tool Retries ---');
const session3 = harness.startRun('Run Unit Test Suite');

console.log('1. Simulating an agent hitting repeated failing bash commands...');
await harness.executeTool(session3, 'echo', { command: 'npm test --failing' });
await harness.executeTool(session3, 'echo', { command: 'npm test --failing' });
await harness.executeTool(session3, 'echo', { command: 'npm test --failing' });

console.log('2. Governance Gate evaluating next proposed model call...');
const planResult3 = await harness.plan(session3, { model: 'claude-opus-5' });

console.log(`   • Circuit Breaker Status: ${planResult3.action.toUpperCase()}`);
console.log(`   • Reason: ${planResult3.plan.reasons[0]}`);

console.log('\n' + '='.repeat(60));
console.log('🎉 Demo Complete: AgentCache Scaffolding protected context, persisted state, saved costs, and stopped runaways!\n');
