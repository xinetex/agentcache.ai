# Background Agent Runtime — the control plane, made durable

Turns AgentCache's three moat pieces into a **governed, durable, human-in-the-
loop runtime** for long-running background agents. This is the "platform" layer:
the thing gateways and orchestration libraries don't provide.

Discipline: **own the moat, rent the engine.** All correctness lives in a pure,
replay-safe reducer (`lib/agent-runtime.js`, 13 tests). Durability and the async
wait primitive are rented from **Inngest** (already a dependency).

## The loop (per step of a run)
```
gate     planStep(policy, run, call)      → governance firewall (allow/pause/block)
block?   budget/quota/kill-switch          → stop the runaway BEFORE the spend
pause?   step.waitForEvent('agent/run.approve', timeout 7d)   → async human-in-the-loop
execute  (your model/tool call)            → prototype charges est. cost
record   recordHit(savings ledger)         → verifiable ROI, per step
```
Reasoning state (facts/decisions/scratch) accumulates across steps via the
reasoning cache and is returned on completion — so the next run resumes it.

## Files
- `lib/agent-runtime.js` — pure: `planStep`, `reduceRun` (total, deterministic,
  replay-safe), `checkpoint`/`restore`, `estimateCostUsd`. The moat.
- `src/inngest/functions/agent-run.ts` — durable Inngest function
  (`agent/run.start`). Each `step.run` is checkpointed + retried; `waitForEvent`
  pauses for a human with zero compute burned while waiting.
- `api/agent/approve.ts` — `POST /api/agent/approve {runId, decision}` emits the
  resume event (async HITL webhook; ac_ auth).
- Registered in `api/inngest.ts` + `src/inngest/types.ts`.

## Trigger a run
```js
await inngest.send({ name: 'agent/run.start', data: {
  runId: 'run_123', agentId: 'researcher', namespace: 'acme',
  organizationId: '<org uuid or redis:<hash>>',
  approvalThresholdUsd: 5,               // any single call ≥ $5 pauses for a human
  steps: [
    { model: 'claude-opus-5', inputTokens: 40000, outputTokens: 8000 },
    { model: 'claude-opus-5', inputTokens: 400000, outputTokens: 80000 }, // ~$4 → gate decides
  ],
}});
```
Resume a paused run: `POST /api/agent/approve` with `{ "runId": "run_123", "decision": "approve" }`.

## To run in production
1. Deploy (done via git push → Vercel; the serve endpoint is `api/inngest.ts`).
2. Set Inngest env (`INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`) in Vercel so the
   functions register with Inngest Cloud. Without them, sends are no-ops locally.
3. Replace the `execute-${i}` step body with your real provider call + usage.
4. Apply the savings/governance migrations (see IDENTITY_AND_ACTIVATION.md) so
   `record` and `load-policy` have their tables.

Roadmap (the "background agent scaffolding" thesis): ephemeral sandboxes
(integrate e2b/Modal — do not build), scheduled/cron runs, and per-run spend
dashboards on the savings ledger.
