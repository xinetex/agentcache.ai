# Prompt Prefix Cache

*Added by the lead-programmer pass, Aug 17 2026. The first addition-to-the-core since the July 29 review — the highest-ROI caching layer the product name promised and didn't yet have.*

## Why this is the right next thing

Your own `CODE_REVIEW_AND_DEFINITION.md` named prefix/prompt caching as *"the highest-leverage, lowest-risk win for agents in 2026, because agentic loops resend the same 20K-token system prompt on every step,"* and noted the product *"doesn't clearly do this yet."* A grep across all 246 API endpoints on `codex/agentic-caching-platform` confirms it still doesn't. Every commit since the review has been a new satellite (trust ledger, evidence packs, Continual Harness, Cayley adapter). This is the missing core layer, built to the definition.

It is also exactly the layer that serves the Origin-scale agent-cost problem: coding agents branch, edit, and iterate at machine velocity, resending a huge stable prefix each step.

## What it does

Agentic loops resend a large, stable prefix — system prompt + tool definitions + early context — on every step. Provider prompt-caches (Anthropic/OpenAI/…) can skip re-reading that prefix if you tell them where it ends. This endpoint tracks, per session, how much of the current prompt is an unchanged prefix of the previous turn and returns the breakpoint.

It is **provider-neutral**: it returns a `breakpointIndex` any caller can act on, and optionally annotates the messages with an Anthropic-style `cache_control` marker.

## API

```
POST /api/cache/prefix
Authorization: Bearer ac_...
X-Cache-Namespace: <namespace>

{ "sessionId": "run-123", "messages": [ ... ], "minPrefixMessages": 1, "annotate": false }
```

Response (200 — a miss is never an error, per the get.ts contract):

```json
{
  "hit": true,
  "reusableMessages": 3,
  "totalMessages": 5,
  "breakpointIndex": 2,
  "reusableTokensApprox": 4800,
  "totalTokensApprox": 5200,
  "savedTokensApprox": 4800,
  "sessionId": "run-123",
  "namespace": "default",
  "organizationSlug": "acme"
}
```

`X-Cache-Status: PREFIX-HIT | PREFIX-MISS`.

## Design decisions

- **Tenant isolation reuses the existing primitive.** Keys are `org_slug:namespace:prefix:<sessionId>` — the same `org_slug:namespace:` prefix `get.ts`/`set.ts` use, extended with a `prefix:` segment. No new isolation model.
- **Auth reuses `api-key-middleware.js`.** Same `validateApiKey` / `validateNamespaceAccess` / `recordUsage` path as `get.ts` — deliberately *not* a new auth path (the review flagged four overlapping auth systems as how gaps happen; this adds zero new ones).
- **Pure logic is isolated + unit-tested.** All prefix math lives in `lib/prefix-cache.js` with no Redis/HTTP deps; `tests/prefix-cache.test.mjs` covers it (11 cases, runs under plain `node` or `vitest`).
- **Lazy Redis client.** Constructed at request time, so a missing env var returns a clean 500 instead of a cold import crash — closes the module-level non-null-assertion note from the review.
- **Fingerprints, not payloads.** Only 16-hex-char per-message hashes are stored (24h TTL), never prompt content — cheap and privacy-preserving.

## Files

- `lib/prefix-cache.js` — pure logic (hash, prefix reuse, token estimate, breakpoint planner).
- `api/cache/prefix.ts` — the Vercel handler.
- `tests/prefix-cache.test.mjs` — unit tests.

## Try it

```bash
node tests/prefix-cache.test.mjs     # 11 passed
```

## Follow-ups (not done here — your call)

1. Wire `savedTokensApprox` into the analytics/telemetry surface so the hit-rate number the value prop rests on is visible.
2. Optional: fold the exact-match cache in — when a prefix hit is *total* (whole message array unchanged) and a completion is cached, short-circuit to it.
3. Swap the ~4-char/token estimator for the caller's real tokenizer count when provided, for exact savings.
