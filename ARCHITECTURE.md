# AgentCache — Architecture & Boundaries

*What this repo is, what's load-bearing, and what's along for the ride. Written July 29, 2026.*

This file exists because the repo grew faster than its definition. Everything under `api/` and the root static files deploys to Vercel as one app, so "just delete it" isn't safe — the reorganization here is **boundaries and quarantine**, not mass deletion. Use this as the map when deciding what to touch.

## The one-sentence definition

**AgentCache is the memory and state layer for AI agents — a spectrum from exact-match replay to malleable working memory — with tenant isolation and guardrails built in.**

Everything else in this repo is either (a) a supporting surface for that, or (b) a satellite experiment that should not block or dilute the core.

## Core — the product. Touch with care, test before shipping.

| Area | Path | Notes |
|---|---|---|
| Exact-match cache | `api/cache/get.ts`, `api/cache/set.ts` | KV over Upstash Redis. Keys are `org_slug:namespace:user_key` — this prefixing is the tenant-isolation primitive. |
| Invalidation / anti-cache | `api/cache/invalidate.ts`, `src/mcp/anticache.ts` | Now auth'd + org-scoped (see Security below). |
| Semantic cache (L3) | `api/cache/semantic.js` | Vector similarity over Upstash Vector. Behind `ENABLE_L3_CACHE` flag, Pro-tier only. Now tenant-filtered. |
| Reasoning / state cache | `sdk-python/agentcache/strategies/reasoning.py` | Working/episodic/procedural memory. The frontier layer — the "malleable" end of the spectrum. |
| Auth | `lib/api-key-middleware.js` (Postgres), `lib/auth-unified.js` (Redis) | **Two parallel systems** — see Debt below. |
| SDKs | `sdk/` (JS/TS), `sdk-python/` | `agentcache-client` is the consolidation target per README. |
| MCP server | `src/mcp/`, routed via `/api/index` | Catch-all `/api/* → /api/index` in `vercel.json`. |

## Supporting surfaces — legitimate, but not the core

Billing/credits (`api/billing`, `api/credits`, Stripe), account/auth pages, docs/blog, dashboards, the marketing site (`index.html` and friends). Keep, but changes here shouldn't be confused with product work on the cache.

## Satellite experiments — isolate; do not let these block core work

These are real code and some may be running, so they are **not** deleted. But they are outside the product definition and should ideally move to their own repos/services over time: `roku_app/`, `hydra-video/`, `transcoder-service/`, `encore-service/`, Solana Pay + `@solana/web3.js`, Telegram (`telegraf`), the 3D "cognitive universe" visualizations (`three`, `react-force-graph-3d`), and the multiple generations of landing pages (`index-v2`, `index-v3`, `index-premium`, `index-legacy`, `_archive/`).

**Dependency implication:** `package.json` currently ships three.js, react-force-graph, Solana, Telegraf, LangChain, and MemVid alongside the cache. That's a large attack + maintenance surface for a cache proxy. When a satellite graduates to its own service, its deps should leave the core `package.json` with it.

## `_attic/` — quarantined dead weight

Inert files moved out of the working tree (not served, not imported, not deployed — excluded via `.vercelignore` and `.gitignore`):

- `grok session 5.27/` (~21 MB stray session dump)
- `studio.html.bak` (132 KB backup of `studio.html`)

Safe to delete permanently once you've confirmed you don't want them. Nothing references them.

## Security fixes applied (July 29, 2026)

1. **`invalidate.ts` now requires authentication.** It previously accepted unauthenticated flush-by-pattern requests — any caller could wipe any tenant's cache. It now validates an `ac_` key and **forces every invalidation under the caller's `org_slug` prefix**, so a tenant can only invalidate its own keys. ⚠️ *Behavior change:* callers that previously hit this endpoint without a key will now get 401 — update any internal callers.
2. **`semantic.js` is now tenant-isolated.** The vector query ran with no namespace/tenant filter, so `topK` matching could return another org's cached response. Reads and writes are now scoped by a `tenant` derived from the API key (metadata filter + tenant-prefixed keys), and the search **fails closed** if no tenant resolves. ⚠️ Pre-existing entries lack the `tenant` field, so they become misses (recomputed) rather than leaking — safe by design.
3. **CORS fixed on `invalidate.ts`.** Removed the invalid/insecure `Allow-Origin: *` + `Allow-Credentials: true` combination.

## Known debt (not yet addressed)

- **Two auth systems.** get/set use `lib/api-key-middleware.js` (Postgres, org-scoped, `allowed_namespaces`); semantic uses `lib/auth-unified.js` (Redis, tier-based, no org concept). This split is why the semantic path had no tenant boundary to begin with. Consolidating to one middleware is the highest-value refactor left.
- **Two cache key schemes.** get/set store `org_slug:namespace:key`; the anticache invalidator indexes `namespace:{ns}` sets + `{key}:meta`. The invalidate fix bridges them by scanning the org-prefixed keyspace, but they should be unified.
- **Contract consistency.** `get.ts` now returns `200 {hit:false}` on a miss (was `404`). Audit any other cache endpoints for the same 404-on-miss pattern.
- **Dirty working tree.** Several core files are modified-but-uncommitted and ~20 files untracked. Commit or revert so "what's shipped" is unambiguous.
