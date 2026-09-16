# AgentCache — Code Review & Enhancement Proposal (2026-09-08)

Branch `feat/agentcache-core`, 16 uncommitted changes (the background-agent runtime: sandbox, compactor, HITL notifier, `src/api/agent.ts`, migration). Unified suite: **15 suites / 129 tests green**. Verdict: the pure core (governance, savings, reasoning cache, run reducer) is solid and well-tested; the **I/O shell around the agent runtime has four P0 defects** that the unit tests structurally cannot see. Fix those before pushing `feat/agentcache-core` further.

---

## Part 1 — Code review

### P0 — fix before push

**1. Tenant-isolation hole on approve / cancel (IDOR).**
`api/agent/approve.ts` and `src/api/agent.ts` (`/approve`, `/cancel`) validate that the caller has *a* valid `ac_` key, then emit `agent/run.approve` / `agent/run.cancel` for **any** `runId`. Nothing checks the run belongs to the caller's organization. Any customer can approve, reject or kill any other customer's paused run.
Fix: resolve `runId → organization_id` from `background_agent_runs` and 403 on mismatch; additionally include `organizationId` in the approve event and tighten the Inngest match to `async.data.runId == "…" && async.data.organizationId == "…"`.

**2. Cancel is a no-op.**
`agent/run.cancel` is sent by the API and the MCP tool, but `src/inngest/functions/agent-run.ts` never subscribes to it (no `cancelOn`). The "emergency kill" only flips a DB row; the run keeps executing and spending.
Fix: `createFunction({ id, cancelOn: [{ event: 'agent/run.cancel', if: 'async.data.runId == event.data.runId' }] }, …)`.

**3. Run state is never persisted; status endpoint reports fiction.**
The Inngest function never writes to `background_agent_runs` — no `spent_usd`, `saved_usd`, `checkpoint_state`, or terminal status. The only insert is at dispatch, and that table is **not** in `lib/ensure-schema.js` (only `savings_events` and `governance_policies` self-provision), so on prod the insert fails silently and `GET /api/agent/run/:id` falls through to a hard-coded `{status:'running'}`.
Fix: add the table to `ensureSchema`; add a `persist-${i}` step after each `EXECUTE` (and on every terminal exit) that upserts `checkpoint(run)`, spend, saved, status, reasons.

**4. The governance gate is per-run, not per-org.**
`planStep` receives `spentUsd: run.spentUsd`, `usedRequests: run.stepsExecuted`, `series: run.series` (always `[]`). Org-wide spend, quota consumption and the spend series are never loaded, so the headline promise — "your agent burned $4k overnight; here's the firewall" — is false for anything beyond one run: ten concurrent runs each see $0 spent. Budget, quota and anomaly detection are all effectively disabled at the org level.
Fix: in `load-policy`, also load org spend-to-date + daily series (from `savings_events`/usage), pass `spentUsd = orgSpent + run.spentUsd`; refresh every N steps or via a cheap Redis counter incremented in `EXECUTE`.

### P1 — correctness and honesty

**5. Approval buttons can't work.** `buildApprovalCard` emits `GET /api/agent/approve?runId=…&decision=approve` links; the endpoint is POST-only and requires a Bearer key. Slack buttons are dead. If made GET-able as-is it would be an unauthenticated kill switch. Fix: signed single-use approval tokens (HMAC over `runId|step|decision|exp`, secret `HITL_SIGNING_KEY`), accepted on `GET /api/agent/approve?token=…` with no API key; POST path keeps key auth + org check.

**6. Duplicate approve endpoints.** `api/agent/approve.ts` (Vercel function) and `src/api/agent.ts` (Hono route mounted at `/api/agent/*`) both handle `/api/agent/approve`. Keep the Hono one, delete the file, keep `vercel.json` routing unambiguous.

**7. Expression injection.** `runId` (user-supplied at dispatch) is interpolated into the CEL string `` `async.data.runId == "${runId}"` ``. A quote in `runId` breaks or widens the match. Validate `^[A-Za-z0-9_-]{8,64}$` at dispatch; or always server-generate `runId`.

**8. `lib/agent-sandbox.js` is not a sandbox.** It's an in-process `Promise.race` — the timeout rejects the await but does not stop the handler; `calculator` uses `new Function` (regex-whitelisted, but still eval in the API process); and `agent-run.ts` calls `executeTool(call.toolCall)` **without a registry**, so only `echo/calculator/json_transform/noop` can ever run. Rename to `tool-harness`, make the registry injectable from dispatch (tool → HTTP/MCP endpoint), and rent real isolation (e2b/Modal) per the own-the-moat/rent-the-commodity thesis.

**9. The "agent" is a governed batch executor.** Steps are pre-declared in the dispatch body; `execute-${i}` is a stub that echoes the estimate as cost; no model ever proposes the next step. `compactHistory` is imported but unused. Documentation (`BACKGROUND_AGENTS.md`, `/docs`) should say "governed durable step runner" until the model-in-the-loop lands (Part 2, item D).

**10. Fail-cold module-level init in the core cache path.** `api/cache/get.ts` still constructs `new Redis({url: …!})` and `neon(process.env.DATABASE_URL!)` at module scope. `neon(undefined)` throws on import, so a missing/rotated `DATABASE_URL` takes down exact-cache GET even though the ledger is optional there. `prefix.ts`/`reasoning.ts` lazy-load Redis but still init `neon` at module scope. Make both lazy and guarded; the cache must serve with Redis alone.

### P2 — hygiene and debt

- **Sprawl (unchanged since July):** 254 files under `api/`, 42 runtime deps (both `aws-sdk` v2 *and* `@aws-sdk/client-s3`, `@solana/*`, `@react-three/*`, `@memvid/sdk`, `d3`, `framer-motion` in an API repo), 12 root-level HTML files, 1.3 GB `node_modules`, 7.4k lines in `lib/`. Vercel builds every `api/**` file as a function; cold-start and build time pay for all of it.
- **Auth consolidation stalled at the re-export.** `lib/auth.js` is canonical on paper; `auth-middleware.js` and `auth-unified.js` still exist and are still imported by the L3 path. Finish the migration and delete.
- **No integration tests.** All 129 tests are pure-function tests. P0 #1–#4 live entirely in the I/O shell. Add an `@inngest/test` suite for `agentRun` (gate→pause→approve→execute→persist; cancel mid-run) and a Hono supertest for approve/cancel cross-org 403.
- **Two stale `index.lock` files** in `.git` — from an interrupted git process; harmless but will block commits until removed.

---

## Part 2 — Enhancement proposal (trends → opportunities)

### Where the market is going (Sept 2026)

1. **Agent security/governance is the funded category.** The top-10 agentic-AI-security startups raised $3.6 B; RSAC 2026 alone saw $392 M in new rounds. Named sub-categories: *non-human identity & agentic access governance* (Oasis, $120 M B), *AI agent security posture* (Noma), *MCP protocol security* (Runlayer, Helmet). Pure-play MCP security has only ~$40 M raised across 17k+ deployed servers — a visible gap.
2. **"MCP gateway" is now a product category** with a defined feature set: authn, authz, rate limiting, audit logging, traffic routing for tool calls — and a dozen vendors (Bifrost, Lunar MCPX, ToolHive, agentgateway, Docker/Microsoft/IBM gateways, Composio, TrueFoundry…). Reported gaps: weak audit trails, inconsistent isolation, no public benchmarks.
3. **Agent payments are standardizing around bounded, signed spend authority.** AP2 (Google + 60 partners): cryptographically signed *mandates* delegating agent authority; ACP (OpenAI/Stripe): time-limited, amount-capped *SharedPaymentTokens*; MPP (Stripe/Tempo): session-level *pre-authorized spending limits* with streamed micropayments; x402 (Coinbase): HTTP-402 stablecoin settlement. The shared primitive is exactly what `lib/governance.js` evaluates — a bounded, revocable, pre-authorized budget.
4. **FinOps for AI is moving from monthly reports to real-time controls** ("agents spend in real time, budgets are annual").

AgentCache's shipped assets map onto all four: a deterministic spend gate, an immutable savings ledger, a guardrails firewall, an MCP server, and a durable HITL run loop. The gap is that these are exposed as *endpoints* rather than as the *primitives the market is naming*: mandates, gateways, receipts.

### Proposed enhancements (ranked by leverage / cost)

**A. Spend Mandates — make the governance gate a signed, delegable object.** *(highest leverage; also the structural fix for P0 #4)*
`mandate = { id, organizationId, agentId?, budgetUsd, quotaRequests, allowedModels[], allowedTools[], maxCostPerCallUsd, expiresAt, approverWebhook, parent? }`, HMAC/Ed25519-signed by AgentCache, issued via `POST /api/governance/mandate`, hierarchical (org → team → agent → run). `planStep` evaluates `decide(mandate ∧ orgPolicy, orgSpend + runSpend)`. Mandate-scoped keys (`ac_run_…`) let a run act only within its mandate. AP2-shaped, so when customers adopt AP2/ACP the mandate is the same object. Pricing hook: per governed run / per active mandate.

**B. MCP Gateway mode — `agentcache-mcp gateway --upstream <server…>`.**
The published `agentcache-mcp` already proxies tools. Add: per-tool allow/deny from the mandate, rate limits, the guardrails firewall on every call, and a per-call **audit row** (tool, args-hash, verdict, cost, latency, run/mandate id) in a new `tool_events` ledger next to `savings_events`. This enters the fastest-growing infra category through its weakest point (audit trails) using the competence AgentCache already has (ledgers). Zero new dependencies.

**C. Run Receipts — the GTM artifact.**
Signed, exportable receipt per run: spend, saved (by layer/model), every gate verdict, every HITL decision with who/when, every tool call (from B). JSON + PDF/HTML, verifiable via `GET /api/receipts/:id/verify`, CSV export for FinOps. This is the literal "here's the firewall + the receipt" pitch, reuses the attic'd certified-runs ledger idea, and is ~1 week once P0 #3 persists state.

**D. Real agent loop — model proposes the next step.**
Provider adapter (Anthropic/OpenAI/OpenRouter) behind `execute-${i}`: model returns next tool/model call → `planStep` gates it → sandbox → `compactHistory` between turns → prefix/reasoning cache consulted automatically and hits recorded. Turns the "step runner" into the background-agent runtime the docs already describe. Required for D-tier customers; do it after A–C so every step is mandate-governed and receipted from day one.

**E. Rented isolation.** `executeTool` gets an `Executor` interface; ship `LocalExecutor` (current) and `E2BExecutor`/`ModalExecutor`. Keeps the subtraction discipline.

**F. Watch, don't build (yet):** x402/MPP settlement for pay-per-run metering. Revisit once mandates exist — a mandate with a settlement rail is the natural next product, but the protocols are still consolidating.

### 90-day sequence

| Weeks | Work | Exit criterion |
|---|---|---|
| 1–2 | P0 #1–#4, P1 #5–#7, #10; `@inngest/test` + cross-org 403 tests; delete legacy auth files + duplicate approve | cancel works, status truthful, org-level gate, no IDOR; suites green incl. integration |
| 3–6 | **A. Mandates** + **C. Receipts** | mandate-scoped run end-to-end with signed receipt; console shows it |
| 7–10 | **B. Gateway mode** + `tool_events` ledger | `npx agentcache-mcp gateway` in front of a third-party MCP server with audit rows |
| 11–12 | **D. Real loop** + **E. Executor interface** | a model-driven 20-step run, gated, compacted, receipted |

Subtraction in parallel: move non-core `api/*` directories to `_attic/` behind one PR per directory; drop `aws-sdk` v2, `@solana/*`, `@react-three/*` from the API package; target < 60 functions on Vercel.

---

### Sources
- [Agentic AI security funding & M&A, RSAC 2026](https://softwarestrategiesblog.com/2026/03/28/agentic-ai-security-startups-funding-mna-rsac-2026/)
- [MCP gateway comparison 2026 — Requesty](https://www.requesty.ai/blog/mcp-gateway-comparison-2026-enterprise-scalability-security)
- [Agentic payment protocols compared (x402, AP2, ACP, MPP) — Crossmint](https://www.crossmint.com/learn/agentic-payments-protocols-compared)
- [AI agents spend in real time, governance is annual — Zen Ex Machina](https://zenexmachina.com/ai-agents-spending-real-time-funding-governance-annual/)
- [AI agent cost control — Portal26](https://portal26.ai/ai-agent-cost-control-stop-agents-burning-budget/)
