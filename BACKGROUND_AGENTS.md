# Background Agent Scaffolding Platform — 360° Architecture

Turns AgentCache into an autonomous **Background Agent Scaffolding Platform** for long-horizon, headless, and asynchronous agent workloads.

Discipline: **own the moat, rent the engine.** All business logic, state reducers, observation distillation, sandbox boundaries, and governance tripwires live in pure, replay-safe, unit-tested modules. Durability, async sleeps, and event triggers are rented from **Inngest**.

---

## The 6 Pillars of the Scaffolding Harness

```
                                    ┌─────────────────────────────┐
                                    │  Trigger Surface (Dispatch) │
                                    │ - REST: POST /api/agent/run │
                                    │ - Webhook / GitHub / Cron   │
                                    │ - MCP: agentcache_run_*     │
                                    └──────────────┬──────────────┘
                                                   │
                                                   ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 BACKGROUND AGENT SCAFFOLDING HARNESS                                   │
│                                                                                                        │
│  ┌─────────────────────────┐  ┌──────────────────────────┐  ┌───────────────────────────────────────┐  │
│  │ 1. Durable State Loop   │  │ 2. Context Compactor     │  │ 3. Tool Sandbox & Tracing             │  │
│  │ - Step checkpointing    │  │ - Observation condenser  │  │ - Safe tool executor                  │  │
│  │ - Event wait/resume     │  │ - Semantic fact pruning  │  │ - Output budget truncation            │  │
│  │ - Replay-safe state     │  │ - Cross-session recall   │  │ - Tamper-evident execution trace      │  │
│  └────────────┬────────────┘  └────────────┬─────────────┘  └───────────────────┬───────────────────┘  │
│               │                            │                                    │                      │
│  ┌────────────▼────────────────────────────▼────────────────────────────────────▼───────────────────┐  │
│  │ 4. Pre-Execution Governance Gate & Circuit Breaker                                               │  │
│  │ - Real-time token & dollar budget enforcement                                                    │  │
│  │ - Z-score repetition & cyclic loop-anomaly detector                                              │  │
│  │ - Risk-tiered permission check (Safe -> Auto, High-Risk/Cost -> Pause for Human)                 │  │
│  └─────────────────────────────────────────┬────────────────────────────────────────────────────────┘  │
│                                            │                                                           │
│  ┌─────────────────────────────────────────▼────────────────────────────────────────────────────────┐  │
│  │ 5. Asynchronous HITL Bridge (Human-in-the-Loop)                                                  │  │
│  │ - Dispatch interactive approval signals (Slack / Discord / Webhook)                              │  │
│  │ - Zero-compute suspension while awaiting human verdict                                           │  │
│  │ - Resume on POST /api/agent/approve                                                              │  │
│  └─────────────────────────────────────────┬────────────────────────────────────────────────────────┘  │
│                                            │                                                           │
│  ┌─────────────────────────────────────────▼────────────────────────────────────────────────────────┐  │
│  │ 6. Verifiable Savings Ledger & Agent Run Store                                                   │  │
│  │ - Per-step token & dollar accounting (hits + misses)                                             │  │
│  │ - Immutable run receipts & status queried via GET /api/agent/run/:runId                          │  │
│  └──────────────────────────────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Modules & API Surfaces

1. **State Machine & Loop Anomaly Detector** (`lib/agent-runtime.js`):
   * Pure, deterministic reducer with `detectCyclicAnomaly` (stops repeating loops), `planStep`, and `reduceRun`.
2. **Context Compactor & Observation Distiller** (`lib/context-compactor.js`):
   * `truncateObservation` bounds large outputs; `compactHistory` consolidates multi-turn histories to prevent token limit crashes.
3. **Tool Sandbox Harness** (`lib/agent-sandbox.js`):
   * Timeouts, memory boundaries, and error isolation for built-in and custom tools.
4. **HITL Notification Bridge** (`lib/hitl-notifier.js`):
   * Formats Slack blocks and JSON payloads for asynchronous human approval cards.
5. **Durable Inngest Function** (`src/inngest/functions/agent-run.ts`):
   * Durable step checkpointing, zero-compute pauses, sandbox tool execution, and savings ledger recording.
6. **HTTP Control Plane** (`src/api/agent.ts`):
   * `POST /api/agent/dispatch` (or `/api/agent/run`): Launches a background task.
   * `GET /api/agent/run/:runId`: Live status and checkpoint inspection.
   * `POST /api/agent/approve`: Emits resume/rejection approval webhook.
   * `POST /api/agent/cancel`: Emergency kill-switch for runaway agents.
7. **Agent MCP Tools** (`src/mcp/tools/controlplane.ts`):
   * `agentcache_run_dispatch`, `agentcache_run_status`, `agentcache_run_approve`, `agentcache_run_cancel`.

---

## Running Unified Tests

```bash
# Run the complete AgentCache core & background agent test suite (15 suites / 129 tests)
node scripts/agentcache-test.mjs

# Run contract and cognitive verification
npm run test:verification
```
