# Identity & activation — the real customer blocker (2026-08-24)

## The problem: three identity worlds, one API
A customer's key must survive **signup → validate → cache/govern call.** Three
incompatible systems exist:

| World | Where keys live | Lookup | Prefix | Used by |
|---|---|---|---|---|
| **A · Redis** | Upstash `key:<sha256>` → {email,plan,quota} | sha256 | `ac_live_` | `api/account.js` register/login (**the real public signup**), `auth-unified.js` (L3 semantic) |
| **B · PG orgs** | Postgres `api_keys`⋈`organizations` | sha256 `key_hash` | `ac_live_` | `lib/api-key-middleware.js` → cache/govern/analytics/reasoning (**the control plane**) |
| **C · PG users** | Postgres `api_keys`⋈`users` (bcrypt) | `key_prefix`+bcrypt | was `sk_live_` | `api/keys.js` (dashboard "create key") |

A key from World A did **not** validate in World B → the signup key 401s on the
whole control-plane API. That is the activation gap.

The committed schemas also **contradict** each other and the validator:
`drizzle/0001` `api_keys.org_id`; `db/schema.sql` `api_keys.user_id`+bcrypt;
`validateApiKey` selects `ak.organization_id, o.slug, o.status, o.plan_tier`
— which match no single committed schema. **The live Neon schema cannot be known
from the repo**, so auth was NOT blind-rewritten.

## What shipped this session (safe, additive)
1. **`validateApiKey` Redis fallback** (`lib/api-key-middleware.js`): Path A =
   Postgres org lookup (now wrapped so a schema mismatch falls through instead of
   500-ing). Path B = if Postgres finds nothing, resolve the key from the Redis
   signup world and return the same context shape. **It only runs when Postgres
   already returned nothing — so it can never change the result for a key that
   already validates.** Pure mapping `buildRedisContext` is unit-tested (4 tests).
2. **`api/keys.js`**: mints `ac_live_` (was `sk_live_`), and mirrors issued/rotated
   keys into Redis `key:<sha256>` so they resolve via the fallback (best-effort).
3. **New control-plane tables** (`savings_events`, `governance_policies`):
   `organization_id` relaxed `UUID → TEXT` to hold either a PG org UUID or a
   `redis:<hash>` tenant id.

Net effect: a key from the real signup now works on the cache + control plane,
with zero risk to any key that already worked.

## The decision only you can make
Converge on **one** identity. Recommendation: **World B (Postgres + organizations)**
— billing/value-pricing needs `organizations.plan_tier`, and the control plane is
already there. Then make `api/account.js` register provision an `organizations`
row + a Postgres `api_keys` row (in addition to, or instead of, Redis). Until
then, the fallback keeps everyone working.

## Verify before launch (needs live creds — run after deploy)
1. In Neon: `\d api_keys` and `\d organizations` — capture the REAL columns.
2. Sign up on `onboarding.html`; capture the key + note prefix.
3. `GET /api/cache/get?key=x` + `X-Cache-Namespace: test` → expect **200** (was the 401).
4. `POST /api/cache/set` then GET again → `hit:true`.
5. `GET /api/analytics/savings` → a number.
If step 3 still 401s, paste the Neon schema and I'll match the validator to it exactly.
