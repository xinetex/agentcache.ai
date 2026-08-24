# Control-Plane Build — 2026-08-24

Executes the repositioning brief ("From cache to control plane"). Same bones,
sharper spear: the Savings Engine goes live on the real hit path, and a
cost-governance + safety control plane lands on top of it. **All 9 core suites
green — 87 tests (was 51).** Run: `node scripts/agentcache-test.mjs`.

## What shipped

### Move 1 — Savings Engine, live (the load-bearing one)
`recordUsage()` logged only {requests,hits,misses}. Now every cache hit records
**model + layer + saved tokens + saved dollars** to an immutable ledger.
- `lib/savings-recorder.js` — pure `savingsFromHit` + fail-open `recordHit`. (10 tests)
- `migrations/2026-08-24_savings_events.sql` — the `savings_events` ledger.
- `api/analytics/savings.ts` — GET aggregation → net $ saved, ROI, by-model/layer/day.
- Wired into `api/cache/get.ts` (exact) and `api/cache/prefix.ts` (prefix),
  ledger-only so the existing daily aggregate is untouched (no double count).

### Move 2 — Governance control plane (the reposition)
The thing Stripe/OpenRouter do **not** do: govern the call, not just bill it.
- `lib/governance.js` — pure `evaluateSpend`, `checkQuota`, `detectAnomaly`
  (z-score spike), `decide` gate. Fail-safe: unconfigured dims → allow;
  kill-switch → deny. (16 tests)
- `lib/governance-data.js` — org spend/quota/series loader (degrades to zero).
- `api/governance/policy.ts` (GET/POST budget, quota, kill-switch, anomaly),
  `status.ts` (read model), `gate.ts` (deterministic allow/deny before spend).
- `migrations/2026-08-24_governance.sql` — `governance_policies`.
- `governance-console.html` — the reframed surface (also published as an Artifact).

### Move 4 — Reasoning / state cache (the moat)
Durable per-agent, per-task state that survives ACROSS runs — the tenth run
starts where the ninth left off. A state problem a gateway can't cheaply copy.
- `lib/reasoning-cache.js` — `taskFingerprint`, `mergeState` (append+dedupe),
  `selectRelevant`, `summarizeCarry`. (10 tests)
- `api/cache/reasoning.ts` — resume/commit handler; a real resume logs a
  'reasoning' savings hit valued at carried tokens.

### Move 3 — Auth consolidation (safe)
- `lib/auth.js` — single canonical import surface; `AUTH_CONSOLIDATION.md` the plan.
- No deletions: legacy modules are still imported by live endpoints. Façade lets
  callers migrate import-by-import with the suite green at each step.

## To go fully live (2 apply steps + 1 instrument)
1. **Apply migrations** to the Neon DB (both files in `migrations/`). Nothing
   reads the new tables until they exist; recorder fails open until then.
2. **Declare model + tokens on hits.** The recorder reads `X-Model`,
   `X-Input-Tokens`, `X-Output-Tokens` (prefix uses `X-Prefix-Tokens`). Absent
   them a hit is still logged, valued $0 (never overstated). Add these headers in
   the SDK so savings are priced.
3. **Miss-cost capture (budget precision).** Governance spend = Σ(cost_baseline −
   cost_saved) from the daily aggregate; it's correct-by-construction but reads 0
   until the request path also records the cost of MISSES. That's the next
   instrument — parallels Move 1, and it's what makes the budget dimension exact.

## Known follow-ups
- **Identity unification is the semantic-cache unlock.** `api/cache/semantic.js`
  runs on the Redis key-hash identity (`auth-unified`), not the neon org UUID, so
  its savings can't attribute to an org yet. Wiring it is deliberately deferred
  to Move 3 step 2 (see AUTH_CONSOLIDATION.md) rather than forced with a broken
  id mapping.
- `.fuse_hidden*` files in the tree are mount temp-files from this session; ignore.
