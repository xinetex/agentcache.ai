# P0 Remediation — 2026-09-08

Fixes for the four P0s and three P1s in `CODE_REVIEW_2026-09-08.md`.
Suite: **17 suites / 157 tests** (was 15 / 129). Typecheck clean on the agent surface.

## What was wrong, and what now prevents it

### P0-1 · Cross-tenant kill switch (IDOR) — FIXED
`/api/agent/approve` and `/cancel` authenticated the **caller** (any valid `ac_` key) and never authorized the **object**. Any customer could approve, reject or kill any other customer's paused run by guessing a `runId` — on the one endpoint whose whole job is stopping spend.

New `lib/run-authz.js`: `checkRunOwnership` / `assertRunOwnership`, wired into approve, cancel and status. **Fails closed** — an unknown run is 404, an unreachable ownership store is 503, never an implicit grant. `GET /api/agent/run/:id` and the status `UPDATE`s are now scoped `AND organization_id = …`.
*Deliberate inversion:* telemetry fails open, authorization fails closed. Losing a telemetry row costs a number; losing an authz row costs a tenant.

### P0-2 · `agent/run.cancel` was a no-op — FIXED
The event was emitted by the API and the MCP tool; nothing subscribed. "Emergency kill" flipped a database row while the run kept spending. Added `cancelOn: [{ event: 'agent/run.cancel', if: 'async.data.runId == event.data.runId' }]`.

### P0-3 · Run state was never persisted — FIXED
The Inngest function computed spend, savings and checkpoints, then discarded them. Nothing wrote `background_agent_runs`; the table wasn't self-provisioned; `GET /api/agent/run/:id` returned a hard-coded `{status:'running'}` for every run ever dispatched, finished or killed.

New `lib/run-store.js`: `ensureAgentRunSchema` + `persistRun` (upsert), called at dispatch and at **every** checkpoint — start, block, pause, kill, each step, complete. The dispatch write is now **awaited**, because that row is what authorization checks: ownership must exist before the first approval can arrive. The status endpoint returns **404 instead of inventing `running`** — a dashboard that guesses is a dashboard that lies about money.

### P0-4 · The budget gate was per-run, not per-org — FIXED
`planStep` received `spentUsd: run.spentUsd` — this run's spend, starting at zero. Ten concurrent runs each believed the org had spent nothing, so an org budget could be overrun N times. The product promise ("your agent burned $4k overnight; here's the firewall") did not hold beyond a single run.

`loadGovernanceContext` (org policy + month-to-date spend + request volume + daily series, via the existing `governance-data.js`) and pure `mergeRunContext` now fold org posture into every verdict. Today's series point includes the run's **in-flight** spend, so a runaway is visible to anomaly detection immediately rather than tomorrow.
Regression test `THE BUG: a $500 budget is not enforceable per-run alone` asserts both halves: naive context → `proceed`, org-aware context → `block`.

### P1-5 · Slack approval buttons were dead *and* unsafe — FIXED
`buildApprovalCard` emitted `GET …?runId=&decision=approve` against a POST-only, key-required endpoint. Dead as written; an unauthenticated kill switch if it had been made to work, sitting in a chat channel.

HMAC-SHA256 signed tokens (WebCrypto, edge-safe): one run, one org, one step, **one decision**, expiring at 7d to match the `waitForEvent` timeout. New `GET /api/agent/approve?token=…` needs no API key because the token *is* the authorization, and still re-checks ownership. Tokens require `HITL_SIGNING_KEY`; absent it, no clickable link is emitted.

### P1-6 · Duplicate approve endpoint — FIXED
`api/agent/approve.ts` (Vercel fn) and the Hono route both served `/api/agent/approve`. The Vercel one — which had no ownership check — is retired to `_attic/`.

### P1-7 · Expression injection via `runId` — FIXED
`runId` is interpolated into the Inngest CEL match; a quote could break or **widen** it to other runs. `isValidRunId` locks it to `^[A-Za-z0-9_-]{8,64}$` at dispatch, approve, cancel and inside the run function. Caller-supplied ids are accepted only if they survive; otherwise server-minted.

### P1-10 · Fail-cold init in the core cache path — FIXED
`api/cache/get.ts` built `neon(process.env.DATABASE_URL!)` at module scope. `neon(undefined)` **throws at import**, so a missing or rotated `DATABASE_URL` took down exact-cache reads — though the ledger is optional telemetry there. Both Redis and Neon are now lazy and guarded; the cache serves from Redis alone.

### Bonus · every unspecified step was costed at $0
The runtime defaulted to `claude-3-5-sonnet`, which is **not in the price table** — so `estimateCostUsd` returned 0, invisible to the budget gate and worth nothing in the ledger. Defaults to the priced `claude-sonnet-5`. Found by a test written for something else.

## Files
**New:** `lib/run-authz.js`, `lib/run-store.js`, `tests/run-authz.test.mjs` (17), `tests/run-store.test.mjs` (11)
**Changed:** `src/inngest/functions/agent-run.ts`, `src/api/agent.ts`, `lib/hitl-notifier.js`, `api/cache/get.ts`, `scripts/agentcache-test.mjs`
**Retired:** `api/agent/approve.ts` → `_attic/agent-approve.superseded.ts`

## Deploy note
Set **`HITL_SIGNING_KEY`** in Vercel (any high-entropy string) before relying on Slack approval buttons. Everything else self-provisions on cold start. No manual migration needed — `ensureAgentRunSchema` creates `background_agent_runs` on first run.

## Still open (next, per the review's 90-day plan)
`@inngest/test` integration suite for the gate→pause→approve→persist path and cancel-mid-run; finish auth consolidation (delete `auth-middleware.js` / `auth-unified.js`); then **Spend Mandates** → **Run Receipts** → **MCP Gateway mode**.
