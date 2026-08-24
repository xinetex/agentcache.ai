# Auth consolidation (Move 3)

**Goal:** one auth module, one tenant identity. Today there are four modules on
two identity models, which is why cross-layer features (e.g. attributing L3
semantic-cache savings to an org) don't line up.

## Canonical
- `lib/api-key-middleware.js` — `ac_` keys → neon `organizations` (**org UUID**).
  Used by `api/cache/get.ts`, `api/cache/prefix.ts`, `api/cache/reasoning.ts`,
  `api/analytics/savings.ts`, and `api/governance/*`.

## Legacy (to be retired)
- `lib/auth-unified.js` — Redis key-hash → tier (`withAuth`); used by
  `api/cache/semantic.js`.
- `lib/auth-middleware.js`, `lib/validate-api-key.js` — older wrappers/validators.

## The single import surface
`lib/auth.js` re-exports the canonical functions (and the legacy `withAuth` as
`withLegacyAuth`). **New code imports auth only from `lib/auth.js`.**

## Migration path (safe, reversible — do NOT big-bang delete)
1. Point every endpoint's auth import at `lib/auth.js`. No behavior change.
2. Unify identity: give the semantic/L3 path an org UUID (map key-hash → org, or
   move it onto `validateApiKey`). **This is the unlock that lets semantic-cache
   savings attribute to an organization in `savings_events`** — until then the
   ledger only carries the canonical (neon-org) layers.
3. Once no file imports the three legacy modules directly (grep is clean),
   delete them in one commit.

## Why it wasn't done as a delete here
`grep` shows legacy modules are still imported by live endpoints. Deleting now
breaks them. The façade lets the migration happen import-by-import with the test
suite green at every step.
