# AgentCache — Core Consolidation

*Aug 17 2026. Everything built in this push, gathered into one coherent product with one test command. Written so a reviewer — or a `git add` — can trust it.*

## The one-sentence product

**AgentCache is the governed, measurable memory & safety layer for AI agents** — it makes agents cheaper (cache), proves it in dollars (savings), feeds them only license-clean data (knowledge), and stops them from acting outside their mission (guardrails). Provider-neutral, tenant-isolated, measured.

## The four pillars — all now code, all tested

| Pillar | What it does | Files | Tests |
|---|---|---|---|
| **Core** (cache engine) | Provider-neutral wrapper: exact + prefix caching | `packages/agentcache-engine/`, `lib/prefix-cache.js`, `api/cache/prefix.ts` | 6 (engine) + 11 (prefix) |
| **Savings** (measurement) | Turns hits into verifiable net-dollars-saved | `lib/savings.js` | 8 |
| **Knowledge** (governed data) | License + PII gate over a curated public-source catalog | `data/sources.json`, `lib/ingest-guard.js` | 9 |
| **Guardrails** (firewall) | Deterministic PEP + swarm circuit breaker | `lib/firewall.js`, `lib/swarm-breaker.js` | 11 + 6 |

**51 tests, one command:** `node scripts/agentcache-test.mjs`.

## How the pillars compose (not four silos — one system)

- The **engine** caches and calls the **savings** math on every hit → the number the business rests on.
- The **knowledge** ingest gate and the **guardrails** firewall share the same fail-closed, provenance-first philosophy — and literally the same PII machinery (`ingest-guard` redaction ≈ firewall's data-provenance layer).
- The **firewall** is what makes the whole thing sellable to regulated buyers: a governed principal that can prove what it was allowed to do.

## Honest debt (what a reviewer must know)

1. **Duplication:** `prefix-cache.js` / `savings.js` exist both in `lib/` (HTTP API) and `packages/agentcache-engine/src/` (self-contained package). Pick one source of truth — likely the package, with `lib/` re-exporting.
2. **Not yet wired to live data:** `api/analytics/savings.ts` isn't built, and `recordUsage()` doesn't yet emit `savedTokens`/`model`/`layer`. Until then the dashboards run on sample data.
3. **Pre-existing repo debt untouched:** still 4 auth files (`api-key-middleware`, `auth-middleware`, `auth-unified`, `validate-api-key`); 246 endpoints; satellites (roku/hydra/transcoder) still in the main package.
4. **Guardrails gaps:** supply-chain (signed skill manifests) and recovery (revocation list + global kill switch) are designed, not built.
5. **Nothing is committed yet.** All of the above is untracked on disk.

## Commit recipe (run when you're ready)

```bash
cd ~/Documents/agentcache-ai
# if a stale git lock exists from tooling, clear it first:
#   rm -f .git/index.lock
git checkout -b feat/agentcache-core
git add lib/prefix-cache.js lib/savings.js lib/ingest-guard.js lib/firewall.js lib/swarm-breaker.js \
        api/cache/prefix.ts tests/*.mjs data/sources.json packages/agentcache-engine \
        public/data-catalog.html public/agent-firewall.html scripts/agentcache-test.mjs \
        PREFIX_CACHE.md DATA_CATALOG.md AGENT_FIREWALL.md CONSOLIDATION.md
node scripts/agentcache-test.mjs   # 51 green
git commit -m "feat(core): cache engine, savings, knowledge gate, capability firewall"
# review, then: git push -u origin feat/agentcache-core   (this is what triggers a Vercel deploy)
```

## Recommended build order after this lands

1. **Dedup** prefix/savings to one source of truth (removes drift risk).
2. **Wire savings to live data** — `recordUsage` emits savedTokens+model+layer; add `api/analytics/savings.ts`. Now the dashboards are real.
3. **Auth consolidation** — 4 files → 1 middleware (the highest-value subtraction).
4. **Signed skill manifests** — close the last open attack class in Guardrails.
