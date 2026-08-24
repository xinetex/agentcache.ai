# Activation audit — the signup → first-call funnel (2026-08-24)

For customers (people or agents), the funnel that matters is:
**sign up → get a key → make a working call → see savings.** Today the code path
mostly works but carries fragmentation that will silently lose signups. Ranked.

## P0 — Two key formats, one of them dead on arrival
Every cache/governance endpoint requires an **`ac_`** key
(`if (!apiKey.startsWith('ac_')) → 401`). Most issuers mint `ac_live_` correctly:
`api/account.js`, `api/auth/register.ts`, `api/portal/provision.js`,
`api/settings.ts`, `api/verify.js`.

But **`api/keys.js` mints `sk_live_`** (`generateAPIKey('sk_live')`). A key issued
there is rejected by the entire cache API. If any dashboard "create key" button
hits `api/keys.js`, the customer's first call 401s and they leave.
→ **Fix:** make `api/keys.js` mint `ac_live_` and delete the `sk_live_` path.

## P0 — Two `api_keys` schemas under one table name
- `lib/api-key-middleware.js` (what the API uses): looks up by **sha256** `key_hash`,
  joins **`organizations`**, reads `organizations.plan_tier`.
- `api/keys.js`: looks up by `key_prefix` + **bcrypt** `key_hash`, joins **`users`**
  + `subscriptions`, reads `subscriptions.plan_tier`.
These cannot both be right against the same row. A key created by one validator
won't validate in the other.
→ **Fix:** pick the `organizations` + sha256 model (the one the API enforces) as
canonical; make every issuer write that shape. This is the same identity
unification tracked in `AUTH_CONSOLIDATION.md`, and it is also what lets L3
semantic-cache savings attribute to an org.

## P1 — Five+ overlapping issuance endpoints
`api/keys.js`, `api/account.js`, `api/auth/register.ts`, `api/portal/provision.js`,
`api/settings.ts`, `api/onboarding/complete.js` all mint keys. Six front doors =
six ways to drift. Collapse to one issuance function that every surface calls.

## P1 — MCP package isn't published
`src/mcp/server.ts` is the agent on-ramp, now exposing the control-plane tools
(`agentcache_gate`, `agentcache_savings`, `agentcache_reasoning_*`). The Start
page tells agents to `npx -y @agentcache/mcp`, but that package isn't on npm yet.
→ **Fix:** publish `@agentcache/mcp` (or the real scope) so the one-line install
is real. This is the single highest-leverage act for "agents using the service."

## The one test to run before any launch
End-to-end against production with a freshly-issued key:
1. sign up on `onboarding.html` → capture the key it returns (note the prefix).
2. `GET /api/cache/get?key=x` with that key + `X-Cache-Namespace` → expect 200.
3. `POST /api/cache/set` then GET again → expect `hit:true`.
4. `GET /api/analytics/savings` → expect a number.
If step 2 401s, the issuer/validator mismatch above is live in production.

## What already shipped toward this (this session)
- Agent adoption: control-plane MCP tools (`src/mcp/tools/controlplane.ts`), registered.
- Front door: `start.html` (shareable Start page, also published as an Artifact).
- The value the funnel sells — savings ledger + governance gate — is built and green.
